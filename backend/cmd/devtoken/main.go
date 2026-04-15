package main

import (
	"flag"
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
	jwtpkg "wurenji-backend/internal/pkg/jwt"
	"wurenji-backend/internal/repository"
)

func main() {
	phone := flag.String("phone", "", "phone number to mint access token for")
	configPath := flag.String("config", "config.yaml", "config file path")
	flag.Parse()

	if *phone == "" {
		log.Fatal("phone is required")
	}

	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("connect database failed: %v", err)
	}

	user, err := repository.NewUserRepo(db).GetByPhone(*phone)
	if err != nil {
		log.Fatalf("load user failed: %v", err)
	}

	tokens, err := jwtpkg.GenerateTokenPair(user.ID, user.UserType, cfg.JWT.Secret, cfg.JWT.AccessExpire, cfg.JWT.RefreshExpire)
	if err != nil {
		log.Fatalf("generate token failed: %v", err)
	}

	fmt.Print(tokens.AccessToken)
}
