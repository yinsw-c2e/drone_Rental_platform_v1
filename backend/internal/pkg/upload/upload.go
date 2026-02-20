package upload

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type UploadService struct {
	savePath    string
	maxSize     int64 // bytes
	allowedExts []string
}

func NewUploadService(savePath string, maxSizeMB int, allowedExts []string) *UploadService {
	return &UploadService{
		savePath:    savePath,
		maxSize:     int64(maxSizeMB) * 1024 * 1024,
		allowedExts: allowedExts,
	}
}

func (u *UploadService) SaveFile(file *multipart.FileHeader, subDir string) (string, error) {
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !u.isAllowedExt(ext) {
		return "", fmt.Errorf("file type %s is not allowed", ext)
	}

	if file.Size > u.maxSize {
		return "", fmt.Errorf("file size exceeds maximum allowed size")
	}

	dir := filepath.Join(u.savePath, subDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixMilli(), uuid.New().String()[:8], ext)
	dst := filepath.Join(dir, filename)

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer src.Close()

	out, err := os.Create(dst)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer out.Close()

	if _, err = io.Copy(out, src); err != nil {
		return "", fmt.Errorf("failed to save file: %w", err)
	}

	relativePath := filepath.Join("/uploads", subDir, filename)
	return filepath.ToSlash(relativePath), nil
}

func (u *UploadService) isAllowedExt(ext string) bool {
	for _, allowed := range u.allowedExts {
		if ext == allowed {
			return true
		}
	}
	return false
}
