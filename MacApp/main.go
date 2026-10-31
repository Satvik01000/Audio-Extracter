package main

import (
	"embed"
	"net/http"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/src
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "Aura",
		Width:     960,
		Height:    780,
		MinWidth:  780,
		MinHeight: 620,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/media-file" {
					path := r.URL.Query().Get("path")
					if path != "" {
						if _, err := os.Stat(path); err == nil {
							http.ServeFile(w, r, path)
							return
						}
					}
					http.Error(w, "File not found", http.StatusNotFound)
					return
				}
			}),
		},
		BackgroundColour: &options.RGBA{R: 25, G: 25, B: 24, A: 255},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			Appearance:           mac.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			About: &mac.AboutInfo{
				Title:   "Aura",
				Message: "Studio-grade minimalist audio extraction",
				Icon:    appIcon,
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
