package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	ffmpegPath string
}

type FileDetails struct {
	Path          string `json:"path"`
	Name          string `json:"name"`
	Size          int64  `json:"size"`
	SizeFormatted string `json:"sizeFormatted"`
}

type ExtractResult struct {
	OutputPath    string `json:"outputPath"`
	FileName      string `json:"fileName"`
	SizeFormatted string `json:"sizeFormatted"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	ffmpeg := findFFmpeg()
	return &App{
		ffmpegPath: ffmpeg,
	}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Enable file drop callback from Finder
	runtime.OnFileDrop(ctx, func(x, y int, paths []string) {
		if len(paths) == 0 {
			return
		}
		details, err := a.GetFileDetails(paths[0])
		if err == nil {
			runtime.EventsEmit(ctx, "file-dropped", details)
		}
	})
}

// GetFileDetails returns info for a file on disk
func (a *App) GetFileDetails(filePath string) (*FileDetails, error) {
	if filePath == "" {
		return nil, fmt.Errorf("empty file path")
	}
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed reading file: %w", err)
	}
	return &FileDetails{
		Path:          filePath,
		Name:          filepath.Base(filePath),
		Size:          info.Size(),
		SizeFormatted: formatBytes(info.Size()),
	}, nil
}

// SelectFile opens the native macOS open file dialog
func (a *App) SelectFile() (*FileDetails, error) {
	selected, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Video or Audio File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Media Files (*.mp4;*.mkv;*.mov;*.webm;*.avi;*.mp3;*.wav;*.m4a;*.flac)",
				Pattern:     "*.mp4;*.mkv;*.mov;*.webm;*.avi;*.flv;*.wmv;*.mp3;*.wav;*.m4a;*.flac;*.aac;*.ogg;*.opus",
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if selected == "" {
		return nil, nil // User cancelled
	}

	return a.GetFileDetails(selected)
}

// SelectSavePath opens the native macOS save file dialog (NSSavePanel)
func (a *App) SelectSavePath(suggestedName string) (string, error) {
	if suggestedName == "" {
		suggestedName = "output.mp3"
	}
	selected, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Choose Destination to Save MP3",
		DefaultFilename: suggestedName,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "MP3 Audio (*.mp3)",
				Pattern:     "*.mp3",
			},
		},
	})
	if err != nil {
		return "", err
	}
	return selected, nil
}

// Extract extracts audio using FFmpeg directly to the specified destination
func (a *App) Extract(filePath string, beginSeconds float64, endSeconds float64, destinationPath string) (*ExtractResult, error) {
	if filePath == "" {
		return nil, fmt.Errorf("source file path cannot be empty")
	}

	// Verify source exists
	if _, err := os.Stat(filePath); err != nil {
		return nil, fmt.Errorf("source file not found: %w", err)
	}

	// If no destination specified, create a temp file for in-app preview
	actualDestination := destinationPath
	if actualDestination == "" {
		baseName := filepath.Base(filePath)
		ext := filepath.Ext(baseName)
		nameWithoutExt := baseName[:len(baseName)-len(ext)]
		actualDestination = filepath.Join(os.TempDir(), fmt.Sprintf("extracted_%s_%d.mp3", nameWithoutExt, time.Now().UnixNano()))
	}

	// Ensure destination directory exists
	dir := filepath.Dir(actualDestination)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed creating target directory: %w", err)
	}

	// Build FFmpeg extraction arguments
	args := []string{"-y"}
	if beginSeconds > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.2f", beginSeconds))
	}
	if endSeconds > 0 {
		args = append(args, "-to", fmt.Sprintf("%.2f", endSeconds))
	}
	args = append(args,
		"-i", filePath,
		"-vn",
		"-acodec", "libmp3lame",
		actualDestination,
	)

	cmd := exec.CommandContext(a.ctx, a.ffmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("ffmpeg failed: %w: %s", err, string(output))
	}

	// Stat output file
	stat, err := os.Stat(actualDestination)
	if err != nil {
		return nil, fmt.Errorf("output file not generated: %w", err)
	}

	return &ExtractResult{
		OutputPath:    actualDestination,
		FileName:      filepath.Base(actualDestination),
		SizeFormatted: formatBytes(stat.Size()),
	}, nil
}

// RevealInFinder opens macOS Finder and highlights the extracted file
func (a *App) RevealInFinder(filePath string) error {
	if filePath == "" {
		return fmt.Errorf("file path is empty")
	}
	return exec.Command("open", "-R", filePath).Start()
}

func findFFmpeg() string {
	paths := []string{
		"/opt/homebrew/bin/ffmpeg",
		"/usr/local/bin/ffmpeg",
		"/usr/bin/ffmpeg",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p
	}
	return "ffmpeg"
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
