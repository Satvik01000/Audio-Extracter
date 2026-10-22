package extractor

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os/exec"
	"path/filepath"
)

type Service struct {
	toolPath string
}

func NewService(toolPath string) *Service {
	return &Service{
		toolPath: toolPath,
	}
}

func (s *Service) Extract(ctx context.Context, job ExtractionJob) (string, error) {
	if job.FileName == "" {
		return "", errors.New("file name cannot be empty")
	}
	if job.BeginTime < 0 {
		return "", errors.New("invalid begin time: cannot be negative")
	}
	if job.EndTime > 0 && job.EndTime <= job.BeginTime {
		return "", fmt.Errorf("invalid time range: begin time (%.2fs) must be less than end time (%.2fs)", job.BeginTime.Seconds(), job.EndTime.Seconds())
	}

	dir := filepath.Dir(job.FileName)
	base := filepath.Base(job.FileName)
	outputPath := "output_" + job.FileName
	if dir != "." && dir != "" {
		outputPath = filepath.Join(dir, "output_"+base)
	}

	slog.InfoContext(ctx, "starting audio extraction",
		"fileName", job.FileName,
		"beginTime", job.BeginTime.String(),
		"endTime", job.EndTime.String(),
		"outputPath", outputPath,
	)

	args := []string{"-y"}
	if job.BeginTime > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.2f", job.BeginTime.Seconds()))
	}
	if job.EndTime > 0 {
		args = append(args, "-to", fmt.Sprintf("%.2f", job.EndTime.Seconds()))
	}
	args = append(args,
		"-i", job.FileName,
		"-vn",
		"-acodec", "libmp3lame",
		outputPath,
	)

	cmd := exec.CommandContext(ctx, s.toolPath, args...)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		slog.ErrorContext(ctx, "ffmpeg execution failed",
			"error", err,
			"stderr", stderr.String(),
			"fileName", job.FileName,
		)
		return "", fmt.Errorf("ffmpeg failed: %w: %s", err, stderr.String())
	}

	slog.InfoContext(ctx, "audio extraction completed successfully",
		"outputPath", outputPath,
	)

	return outputPath, nil
}
