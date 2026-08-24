package static

import "embed"

//go:embed dist
var Dist embed.FS

// FS 返回嵌入的前端构建产物（vite build 输出，由 build.bat/build.sh 拷贝进 dist/）。
func FS() embed.FS {
	return Dist
}
