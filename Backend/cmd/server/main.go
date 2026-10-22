package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"

	"github.com/Satvik01000/Audio-Extracter/internal/extractor"
)

func main() {
	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil {
		slog.Error("ffmpeg not found", "error", err)
		os.Exit(1)
	}
	slog.Info("ffmpeg binary found", "path", ffmpegPath)

	extractorService := extractor.NewService(ffmpegPath)
	extractorHandler := extractor.NewHandler(extractorService)

	mux := http.NewServeMux()
	extractorHandler.RegisterRoutes(mux)

	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	go func() {
		slog.Info("Server is starting", "addr", server.Addr)

		err := server.ListenAndServe()

		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt, syscall.SIGTERM)

	sig := <-ch
	slog.Info("Shutdown signal received", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = server.Shutdown(ctx)
	if err != nil {
		slog.Error("Server failed to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server shut down gracefully", "addr", server.Addr)
}
