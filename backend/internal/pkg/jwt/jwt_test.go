package jwt

import "testing"

func TestGenerateTokenPairIsUniqueWithinSameSecond(t *testing.T) {
	const secret = "test-secret-with-enough-length"

	first, err := GenerateTokenPair(4, "client", secret, 3600, 7200)
	if err != nil {
		t.Fatalf("GenerateTokenPair() first error = %v", err)
	}
	second, err := GenerateTokenPair(4, "client", secret, 3600, 7200)
	if err != nil {
		t.Fatalf("GenerateTokenPair() second error = %v", err)
	}

	if first.AccessToken == second.AccessToken {
		t.Fatal("access tokens should be unique even when generated with the same user and expiry second")
	}
	if first.RefreshToken == second.RefreshToken {
		t.Fatal("refresh tokens should be unique even when generated with the same user and expiry second")
	}

	claims, err := ParseToken(first.AccessToken, secret)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
	if claims.ID == "" {
		t.Fatal("expected generated token to include a jti")
	}
}
