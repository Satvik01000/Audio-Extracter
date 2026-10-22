package extractor

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type Handler struct {
	extractor AudioExtractor
}

func NewHandler(extractor AudioExtractor) *Handler {
	return &Handler{extractor: extractor}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /extract", h.handleExtract)
}

func (h *Handler) handleExtract(w http.ResponseWriter, r *http.Request) {
	// Read the uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing 'file' field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 3. Create temp workspace on disk
	tempDir, err := os.MkdirTemp("", "extract-*")
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tempDir) // guarantees cleanup

	inPath := filepath.Join(tempDir, header.Filename)

	dst, err := os.Create(inPath)
	if err != nil {
		http.Error(w, "failed saving file", http.StatusInternalServerError)
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		http.Error(w, "failed saving file", http.StatusInternalServerError)
		return
	}
	dst.Close()

	// 4. Parse optional start/end (standard Go duration strings like "5s" or "1m30s")
	var begin, end time.Duration
	if s := r.FormValue("begin"); s != "" {
		begin, _ = time.ParseDuration(s)
	}
	if s := r.FormValue("end"); s != "" {
		end, _ = time.ParseDuration(s)
	}

	// 5. Execute
	job := ExtractionJob{
		FileName:  inPath,
		BeginTime: begin,
		EndTime:   end,
	}

	res, err := h.extractor.Extract(r.Context(), job)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 6. Return audio file
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(res)))
	http.ServeFile(w, r, res)
}