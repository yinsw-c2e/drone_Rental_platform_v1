package service

import (
	"bytes"
	"errors"
	"fmt"
	stdhtml "html"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/phpdave11/gofpdf"

	"wurenji-backend/internal/model"
)

const (
	contractPDFDownloadIssuer  = "wurenji-contract-pdf"
	contractPDFDownloadPurpose = "contract_pdf_download"
	contractPDFDownloadTTL     = 10 * time.Minute
)

type contractPDFDownloadClaims struct {
	UserID  int64  `json:"user_id"`
	OrderID int64  `json:"order_id"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

type ContractPDFDownloadInfo struct {
	Filename    string    `json:"filename"`
	DownloadURL string    `json:"download_url"`
	ExpiresAt   time.Time `json:"expires_at"`
}

var (
	contractHTMLStylePattern  = regexp.MustCompile(`(?is)<style[\s\S]*?</style>`)
	contractHTMLScriptPattern = regexp.MustCompile(`(?is)<script[\s\S]*?</script>`)
	contractHTMLBreakPattern  = regexp.MustCompile(`(?i)<\s*br\s*/?>`)
	contractHTMLBlockPattern  = regexp.MustCompile(`(?i)<\s*/?(p|div|section|article|header|footer|h1|h2|h3|h4|h5|h6|table|tr)\b[^>]*>`)
	contractHTMLListPattern   = regexp.MustCompile(`(?i)<\s*li\b[^>]*>`)
	contractHTMLListEnd       = regexp.MustCompile(`(?i)<\s*/li\s*>`)
	contractHTMLTagPattern    = regexp.MustCompile(`(?s)<[^>]+>`)
	contractHTMLMultiLine     = regexp.MustCompile(`\n{3,}`)
	contractHTMLSpaces        = regexp.MustCompile(`[ \t]{2,}`)
)

var contractPDFFontCandidates = []string{
	"/Library/Fonts/Arial Unicode.ttf",
	"/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
	"/System/Library/Fonts/Supplemental/NISC18030.ttf",
	"/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf",
	"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf",
}

func (s *ContractService) GenerateContractPDFDownloadToken(orderID, userID int64) (string, time.Time, error) {
	if s == nil || s.cfg == nil {
		return "", time.Time{}, errors.New("合同服务未初始化")
	}

	now := time.Now()
	expiresAt := now.Add(contractPDFDownloadTTL)
	claims := contractPDFDownloadClaims{
		UserID:  userID,
		OrderID: orderID,
		Purpose: contractPDFDownloadPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    contractPDFDownloadIssuer,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("签发合同下载令牌失败: %w", err)
	}
	return tokenStr, expiresAt, nil
}

func (s *ContractService) ParseContractPDFDownloadToken(tokenStr string) (int64, int64, error) {
	if s == nil || s.cfg == nil {
		return 0, 0, errors.New("合同服务未初始化")
	}

	token, err := jwt.ParseWithClaims(tokenStr, &contractPDFDownloadClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWT.Secret), nil
	})
	if err != nil {
		return 0, 0, errors.New("合同下载链接已失效，请重新获取")
	}

	claims, ok := token.Claims.(*contractPDFDownloadClaims)
	if !ok || !token.Valid {
		return 0, 0, errors.New("合同下载链接无效")
	}
	if claims.Purpose != contractPDFDownloadPurpose {
		return 0, 0, errors.New("合同下载链接无效")
	}
	if claims.OrderID == 0 || claims.UserID == 0 {
		return 0, 0, errors.New("合同下载链接无效")
	}

	return claims.UserID, claims.OrderID, nil
}

func (s *ContractService) BuildContractPDFByOrder(orderID int64) ([]byte, *model.OrderContract, error) {
	contract, err := s.GetContractByOrder(orderID)
	if err != nil {
		return nil, nil, err
	}

	fontPath, err := resolveContractPDFFontPath()
	if err != nil {
		return nil, nil, err
	}

	bodyText := trimContractPDFBody(contractHTMLToReadableText(contract.ContractHTML), contract)
	if bodyText == "" {
		return nil, nil, errors.New("合同正文为空，暂时无法导出 PDF")
	}

	pdf := gofpdf.New("P", "mm", "A4", filepath.Dir(fontPath))
	pdf.SetMargins(18, 18, 18)
	pdf.SetAutoPageBreak(true, 16)
	pdf.SetTitle(contract.Title, false)
	pdf.SetAuthor("无人机服务平台", false)
	pdf.SetCreator("无人机服务平台", false)
	pdf.AliasNbPages("")
	pdf.SetFooterFunc(func() {
		pdf.SetY(-12)
		pdf.SetTextColor(120, 124, 136)
		pdf.SetFont("contract-cn", "", 9)
		pdf.CellFormat(0, 8, fmt.Sprintf("无人机服务平台电子合同  第 %d / {nb} 页", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	pdf.AddUTF8Font("contract-cn", "", filepath.Base(fontPath))
	if pdf.Err() {
		return nil, nil, fmt.Errorf("加载合同 PDF 字体失败: %w", pdf.Error())
	}

	pdf.AddPage()
	pdf.SetTextColor(24, 28, 39)
	pdf.SetFont("contract-cn", "", 19)
	pdf.CellFormat(0, 10, contract.Title, "", 1, "C", false, 0, "")

	pdf.SetTextColor(103, 110, 124)
	pdf.SetFont("contract-cn", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("合同编号：%s", contract.ContractNo), "", 1, "C", false, 0, "")
	pdf.Ln(3)

	pdf.SetDrawColor(226, 231, 237)
	pdf.Line(18, pdf.GetY(), 192, pdf.GetY())
	pdf.Ln(5)

	pdf.SetTextColor(44, 52, 64)
	pdf.SetFont("contract-cn", "", 11)
	renderContractPDFSummaryRow(pdf, "合同状态", formatContractStatusLabel(contract.Status), "合同总额", "¥ "+formatCentToYuan(contract.ContractAmount))
	renderContractPDFSummaryRow(pdf, "委托方签署", formatContractSignDate(contract.ClientSignedAt), "服务方签署", formatContractSignDate(contract.ProviderSignedAt))
	renderContractPDFSummaryRow(pdf, "生成日期", resolveContractGeneratedDate(contract), "生效日期", valueOrFallback(resolveContractEffectiveDate(contract), "待双方完成签署"))
	pdf.Ln(2)

	pdf.SetTextColor(31, 41, 55)
	pdf.SetFont("contract-cn", "", 12)
	for _, paragraph := range strings.Split(bodyText, "\n\n") {
		trimmed := strings.TrimSpace(paragraph)
		if trimmed == "" {
			continue
		}
		pdf.MultiCell(0, 6.2, trimmed, "", "L", false)
		pdf.Ln(1.5)
	}

	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, nil, fmt.Errorf("生成合同 PDF 失败: %w", err)
	}
	return out.Bytes(), contract, nil
}

func BuildContractPDFFilename(contract *model.OrderContract) string {
	if contract == nil || contract.ContractNo == "" {
		return "contract.pdf"
	}
	return fmt.Sprintf("无人机服务合同-%s.pdf", contract.ContractNo)
}

func BuildContractPDFFilenameHeader(filename string) string {
	fallback := "contract.pdf"
	if filename == "" {
		filename = fallback
	}
	return fmt.Sprintf("attachment; filename=\"%s\"; filename*=UTF-8''%s", fallback, url.QueryEscape(filename))
}

func resolveContractPDFFontPath() (string, error) {
	if customFont := strings.TrimSpace(os.Getenv("CONTRACT_PDF_FONT_PATH")); customFont != "" {
		if stat, err := os.Stat(customFont); err == nil && !stat.IsDir() && probeContractPDFFont(customFont) {
			return customFont, nil
		}
	}

	for _, candidate := range contractPDFFontCandidates {
		stat, err := os.Stat(candidate)
		if err == nil && !stat.IsDir() && probeContractPDFFont(candidate) {
			return candidate, nil
		}
	}

	return "", errors.New("当前服务器缺少可用的中文字体，暂时无法导出 PDF")
}

func renderContractPDFSummaryRow(pdf *gofpdf.Fpdf, leftLabel, leftValue, rightLabel, rightValue string) {
	if pdf == nil {
		return
	}

	pdf.SetFont("contract-cn", "", 10)
	pdf.SetTextColor(103, 110, 124)
	pdf.CellFormat(25, 6, leftLabel, "", 0, "L", false, 0, "")
	pdf.SetTextColor(31, 41, 55)
	pdf.CellFormat(60, 6, leftValue, "", 0, "L", false, 0, "")
	pdf.SetTextColor(103, 110, 124)
	pdf.CellFormat(25, 6, rightLabel, "", 0, "L", false, 0, "")
	pdf.SetTextColor(31, 41, 55)
	pdf.CellFormat(0, 6, rightValue, "", 1, "L", false, 0, "")
}

func contractHTMLToReadableText(value string) string {
	text := stdhtml.UnescapeString(value)
	text = contractHTMLStylePattern.ReplaceAllString(text, "\n")
	text = contractHTMLScriptPattern.ReplaceAllString(text, "\n")
	text = contractHTMLBreakPattern.ReplaceAllString(text, "\n")
	text = contractHTMLBlockPattern.ReplaceAllString(text, "\n")
	text = contractHTMLListPattern.ReplaceAllString(text, "\n• ")
	text = contractHTMLListEnd.ReplaceAllString(text, "")
	text = contractHTMLTagPattern.ReplaceAllString(text, "")
	text = strings.ReplaceAll(text, "\u00a0", " ")
	text = contractHTMLMultiLine.ReplaceAllString(text, "\n\n")
	text = contractHTMLSpaces.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func trimContractPDFBody(body string, contract *model.OrderContract) string {
	if body == "" {
		return ""
	}

	lines := strings.Split(body, "\n")
	filtered := make([]string, 0, len(lines))
	skipTitle := contract != nil && contract.Title != ""
	skipContractNo := contract != nil && contract.ContractNo != ""

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			filtered = append(filtered, "")
			continue
		}

		if skipTitle && trimmed == contract.Title {
			skipTitle = false
			continue
		}
		if skipContractNo && strings.Contains(trimmed, contract.ContractNo) {
			skipContractNo = false
			continue
		}

		filtered = append(filtered, trimmed)
	}

	body = strings.Join(filtered, "\n")
	body = contractHTMLMultiLine.ReplaceAllString(body, "\n\n")
	return strings.TrimSpace(body)
}

func formatContractStatusLabel(status string) string {
	switch status {
	case "pending":
		return "待签署"
	case "client_signed":
		return "委托方已签署"
	case "provider_signed":
		return "服务方已签署"
	case "fully_signed":
		return "合同已生效"
	default:
		if status == "" {
			return "待确认"
		}
		return status
	}
}

func valueOrFallback(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func probeContractPDFFont(fontPath string) (ok bool) {
	defer func() {
		if recover() != nil {
			ok = false
		}
	}()

	pdf := gofpdf.New("P", "mm", "A4", filepath.Dir(fontPath))
	pdf.AddUTF8Font("contract-probe", "", filepath.Base(fontPath))
	if pdf.Err() {
		return false
	}

	pdf.AddPage()
	pdf.SetFont("contract-probe", "", 12)
	pdf.MultiCell(0, 6, "合同字体探测", "", "L", false)
	return pdf.Ok()
}
