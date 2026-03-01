package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"time"
)

func main() {
	// 测试1: 默认HTTP客户端
	fmt.Println("=== 测试1: 默认HTTP客户端 ===")
	testWithClient(&http.Client{Timeout: 10 * time.Second})

	// 测试2: 配置TLS的HTTP客户端
	fmt.Println("\n=== 测试2: 配置TLS MinVersion的HTTP客户端 ===")
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}
	testWithClient(&http.Client{
		Timeout:   10 * time.Second,
		Transport: transport,
	})

	// 测试3: 跳过证书验证(仅用于诊断)
	fmt.Println("\n=== 测试3: 跳过证书验证的HTTP客户端 ===")
	insecureTransport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}
	testWithClient(&http.Client{
		Timeout:   10 * time.Second,
		Transport: insecureTransport,
	})
}

func testWithClient(client *http.Client) {
	url := "https://restapi.amap.com/v3/geocode/regeo?key=dd09b07875e237f695aa6b3cf4c70510&location=113.264435,23.129163&output=JSON"
	
	resp, err := client.Get(url)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ 读取响应失败: %v\n", err)
		return
	}

	fmt.Printf("✅ 请求成功! Status: %s\n", resp.Status)
	fmt.Printf("响应前200字符: %s\n", string(body[:min(200, len(body))]))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
