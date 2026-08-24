// webmirror-desktop：前端桌面壳（Go + gin + systray）。
//
// 它不实现任何业务逻辑，只做三件事：
//   1. 用 //go:embed 把 vite build 出的前端 SPA 打进 exe；
//   2. 起 gin 网关，/api 与 /files 反代到 webmirror 后端（默认 http://localhost:8080）；
//   3. 挂载系统托盘（图标 + “打开界面 / 退出”），启动后自动打开浏览器。
//
// 编译：go build -ldflags="-H windowsgui -s -w" -o webmirror-desktop.exe .
// 真正的中转后端是 webmirror/backend（chatgpt-forward），需另行启动于 :8080。
package main

import (
	_ "embed"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/getlantern/systray"
	"webmirror-client/desktop/internal/browser"
	"webmirror-client/desktop/internal/static"
)

//go:embed icon.ico
var iconBytes []byte

func main() {
	port := envOr("PORT", "5173")
	backendURL := envOr("BACKEND_URL", "http://localhost:8080")
	appURL := "http://localhost:" + port

	// HTTP 网关在后台 goroutine 跑，托盘在主 goroutine 跑
	go func() {
		if err := runGateway(port, backendURL); err != nil {
			log.Printf("gateway error: %v", err)
		}
	}()

	// 后台检测 GitHub 新版本（本地 dev 构建或空 Repo 时自动跳过）
	startUpdateChecker()

	systray.Run(func() {
		systray.SetIcon(iconBytes)
		systray.SetTitle("WebMirror")
		systray.SetTooltip("WebMirror 桌面客户端")
		mOpen := systray.AddMenuItem("打开界面", "在默认浏览器中打开 WebMirror")
		mQuit := systray.AddMenuItem("退出", "退出 WebMirror")
		go func() {
			for {
				select {
				case <-mOpen.ClickedCh:
					_ = browser.OpenURL(appURL)
				case <-mQuit.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
		// 启动后自动打开浏览器
		go func() {
			time.Sleep(800 * time.Millisecond)
			_ = browser.OpenURL(appURL)
		}()
	}, func() {
		os.Exit(0)
	})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func runGateway(port, backendURL string) error {
	gin.SetMode(gin.ReleaseMode) // windowsgui 无控制台，关闭 debug 路由日志
	target, err := url.Parse(backendURL)
	if err != nil {
		return err
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1 // SSE 立即刷新，避免缓冲

	r := gin.New()
	r.Use(gin.Recovery())

	// 更新检测端点（由网关直接处理，不转发给后端，使用 /desktop 前缀避免与 /api/* 冲突）
	r.GET("/desktop/version", versionHandler)
	r.POST("/desktop/update/do", updateDoHandler)

	// 业务 API 与图片静态资源反代到 webmirror 后端（同端口由 webmirror 后端提供）
	r.Any("/api/*path", gin.WrapH(proxy))
	r.Any("/files/*path", gin.WrapH(proxy))

	// 嵌入的前端 SPA（vite build 产物），未知路由回退 index.html
	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if p == "/" {
			serveIndex(c)
			return
		}
		data, err := static.Dist.ReadFile("dist" + p)
		if err != nil {
			serveIndex(c) // 资源缺失或非资源路由 → SPA 回退
			return
		}
		c.Data(http.StatusOK, contentType(p), data)
	})

	log.Printf("WebMirror desktop gateway  http://localhost:%s  → backend %s", port, backendURL)
	return r.Run(":" + port)
}

func serveIndex(c *gin.Context) {
	data, err := static.Dist.ReadFile("dist/index.html")
	if err != nil {
		c.String(http.StatusInternalServerError, "前端未构建：请先运行 build.bat / build.sh")
		return
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", data)
}

func contentType(p string) string {
	switch {
	case strings.HasSuffix(p, ".html"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(p, ".js"):
		return "text/javascript; charset=utf-8"
	case strings.HasSuffix(p, ".css"):
		return "text/css; charset=utf-8"
	case strings.HasSuffix(p, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(p, ".json"):
		return "application/json"
	case strings.HasSuffix(p, ".png"):
		return "image/png"
	case strings.HasSuffix(p, ".ico"):
		return "image/x-icon"
	case strings.HasSuffix(p, ".woff2"), strings.HasSuffix(p, ".woff"):
		return "font/woff2"
	default:
		return "application/octet-stream"
	}
}
