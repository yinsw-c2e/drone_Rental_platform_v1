package upload

import (
	"bytes"
	"encoding/base64"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveFileRejectsMismatchedContentType(t *testing.T) {
	dir := t.TempDir()
	service := NewUploadService(dir, 1, []string{".jpg", ".png", ".pdf"})

	fileHeader := newMultipartFileHeader(t, "avatar.jpg", []byte("%PDF-1.4 fake pdf"))
	if _, err := service.SaveFile(fileHeader, "avatar"); err == nil || !strings.Contains(err.Error(), "does not match extension") {
		t.Fatalf("expected content type mismatch error, got %v", err)
	}
}

func TestSaveFileAcceptsAllowedPNG(t *testing.T) {
	dir := t.TempDir()
	service := NewUploadService(dir, 1, []string{".jpg", ".png", ".pdf"})

	pngBytes, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV7sAAAAASUVORK5CYII=")
	if err != nil {
		t.Fatalf("decode png fixture: %v", err)
	}

	fileHeader := newMultipartFileHeader(t, "avatar.png", pngBytes)
	path, err := service.SaveFile(fileHeader, "avatar")
	if err != nil {
		t.Fatalf("expected png upload to pass, got %v", err)
	}

	fullPath := filepath.Join(dir, filepath.Base(filepath.Dir(path)), filepath.Base(path))
	if _, err := os.Stat(fullPath); err != nil {
		t.Fatalf("expected saved file to exist, got %v", err)
	}
}

func newMultipartFileHeader(t *testing.T, filename string, content []byte) *multipart.FileHeader {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest("POST", "/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if err := req.ParseMultipartForm(int64(len(body.Bytes())) + 1024); err != nil {
		t.Fatalf("parse multipart form: %v", err)
	}

	files := req.MultipartForm.File["file"]
	if len(files) != 1 {
		t.Fatalf("expected exactly one file, got %d", len(files))
	}
	return files[0]
}
