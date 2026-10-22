package extractor

import (
	"context"
	"time"
)

type ExtractionJob struct {
	FileName  string
	BeginTime time.Duration
	EndTime   time.Duration
}

type AudioExtractor interface {
	Extract(ctx context.Context, job ExtractionJob) (outputPath string, err error)
}
