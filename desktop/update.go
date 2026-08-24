package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// 版本信息：由 CI 通过 -ldflags "-X main.Version=... -X main.Repo=owner/repo" 注入。
// 本地构建默认 dev / 空仓库 → 更新检测自动关闭，不会弹出更新提示。
var (
	Version = "dev"
	Repo    = "" // 形如 "owner/repo"，空则禁用更新检测
)

// versionStatus 是最近一次检查结果（latest 为 nil 表示尚未检查或无可用信息）。
type versionStatus struct {
	Current         string `json:"current"`
	Latest          string `json:"latest"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL      string `json:"releaseUrl"`
	// downloadURL 仅内部使用，不暴露给前端
	downloadURL string
}

var (
	releaseMu sync.RWMutex
	latest    *versionStatus
)

// checkForUpdate 查询 GitHub latest release，与当前版本比较，写入 latest。
func checkForUpdate() {
	if Repo == "" || Version == "dev" {
		return
	}
	apiURL := "https://api.github.com/repos/" + Repo + "/releases/latest"
	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "webmirror-desktop")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[update] 检查更新失败: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("[update] GitHub API 返回 %d", resp.StatusCode)
		return
	}
	var gh struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&gh); err != nil {
		log.Printf("[update] 解析响应失败: %v", err)
		return
	}
	if gh.TagName == "" {
		return
	}

	// 选取与当前 exe 同名的 .exe 资产（CI 发布的资产名固定为 webmirror-desktop.exe）
	base := exeBaseName()
	var dl string
	for _, a := range gh.Assets {
		if strings.EqualFold(a.Name, base+".exe") {
			dl = a.BrowserDownloadURL
			break
		}
	}
	if dl == "" {
		// 退而求其次：任取第一个 .exe 资产
		for _, a := range gh.Assets {
			if strings.HasSuffix(strings.ToLower(a.Name), ".exe") {
				dl = a.BrowserDownloadURL
				break
			}
		}
	}

	releaseMu.Lock()
	latest = &versionStatus{
		Current:         Version,
		Latest:          gh.TagName,
		UpdateAvailable: compareSemver(gh.TagName, Version) > 0,
		ReleaseURL:      gh.HTMLURL,
		downloadURL:     dl,
	}
	releaseMu.Unlock()

	if latest.UpdateAvailable {
		log.Printf("[update] 发现新版本 %s（当前 %s）", gh.TagName, Version)
	}
}

// exeBaseName 返回当前可执行文件去扩展名后的名字（如 webmirror-desktop）。
func exeBaseName() string {
	exe, err := os.Executable()
	if err != nil {
		return "webmirror-desktop"
	}
	return strings.TrimSuffix(filepath.Base(exe), filepath.Ext(exe))
}

// startUpdateChecker 启动后台轮询：启动 3 秒后检查一次，之后每 24 小时检查一次。
func startUpdateChecker() {
	if Repo == "" || Version == "dev" {
		return
	}
	go func() {
		time.Sleep(3 * time.Second)
		checkForUpdate()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			checkForUpdate()
		}
	}()
}

// versionHandler 返回当前/最新版本与是否有更新（前端轮询此端点展示提示）。
func versionHandler(c *gin.Context) {
	releaseMu.RLock()
	st := latest
	releaseMu.RUnlock()
	if st == nil {
		c.JSON(http.StatusOK, gin.H{
			"current":         Version,
			"latest":          Version,
			"updateAvailable": false,
			"releaseUrl":      "",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"current":         st.Current,
		"latest":          st.Latest,
		"updateAvailable": st.UpdateAvailable,
		"releaseUrl":      st.ReleaseURL,
	})
}

// updateDoHandler 执行自更新：下载新 exe 并就地替换当前进程后重启。
func updateDoHandler(c *gin.Context) {
	releaseMu.RLock()
	st := latest
	releaseMu.RUnlock()
	if st == nil || !st.UpdateAvailable || st.downloadURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "没有可用更新或下载地址未知"})
		return
	}
	if err := doSelfUpdate(st.downloadURL); err != nil {
		log.Printf("[update] 自动更新失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	// 进程将被 doSelfUpdate 中的 os.Exit 终止，正常不会执行到这里
	c.JSON(http.StatusOK, gin.H{"ok": true, "restarted": true})
}

// doSelfUpdate 下载新 exe 并就地替换当前进程（Windows 友好：运行中的 exe 可 rename 不可 delete）。
func doSelfUpdate(downloadURL string) error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest(http.MethodGet, downloadURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "webmirror-desktop")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载更新失败，HTTP %d", resp.StatusCode)
	}

	tmp := exePath + ".new"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, resp.Body); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	out.Close()

	// Windows 下运行中的 exe 允许 rename（不允许 delete/write），先挪走旧文件
	old := exePath + ".bak"
	_ = os.Remove(old)
	if err := os.Rename(exePath, old); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("无法自动替换运行中的程序（%v），请手动下载更新", err)
	}
	if err := os.Rename(tmp, exePath); err != nil {
		_ = os.Rename(old, exePath) // 极端情况尽量恢复
		return err
	}

	// 启动新版本（沿用原启动参数），随后退出当前进程
	cmd := exec.Command(exePath, os.Args[1:]...)
	if err := cmd.Start(); err != nil {
		return err
	}
	log.Printf("[update] 已替换为新版本，重启中…")
	os.Exit(0)
	return nil
}

// compareSemver 语义化版本比较，返回 -1/0/1。忽略前导 v 与预发布后缀。
func compareSemver(a, b string) int {
	pa := parseVersion(a)
	pb := parseVersion(b)
	for i := 0; i < 3; i++ {
		if pa[i] != pb[i] {
			if pa[i] > pb[i] {
				return 1
			}
			return -1
		}
	}
	return 0
}

func parseVersion(s string) [3]int {
	var v [3]int
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(strings.TrimPrefix(s, "v"), "V")
	parts := strings.Split(s, ".")
	for i := 0; i < len(parts) && i < 3; i++ {
		n, err := strconv.Atoi(strings.Split(parts[i], "-")[0]) // 忽略 -beta 等后缀
		if err == nil {
			v[i] = n
		}
	}
	return v
}
