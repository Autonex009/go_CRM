package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	err := filepath.Walk("services/internal", func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, ".sql") {
			return nil
		}

		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		content := string(b)
		orig := content

		// Replace company_id -> account_id
		content = strings.ReplaceAll(content, "company_id", "account_id")
		content = strings.ReplaceAll(content, "CompanyID", "AccountID")
		
		// Replace company_profiles -> account_profiles
		content = strings.ReplaceAll(content, "company_profiles", "account_profiles")

		// Replace 'companies' -> 'accounts' (be careful with whole words)
		// We'll just replace 'companies' and hope we don't hit 'companies_something'
		// Wait, what about 'FROM companies'?
		content = strings.ReplaceAll(content, "FROM companies", "FROM accounts")
		content = strings.ReplaceAll(content, "JOIN companies", "JOIN accounts")
		content = strings.ReplaceAll(content, "INTO companies", "INTO accounts")
		content = strings.ReplaceAll(content, "companies(", "accounts(")
		content = strings.ReplaceAll(content, "companies ", "accounts ")
		
		// Special case for store.go comments
		content = strings.ReplaceAll(content, "`companies` table", "`accounts` table")

		if content != orig {
			fmt.Printf("Updated %s\n", path)
			return os.WriteFile(path, []byte(content), info.Mode())
		}
		return nil
	})
	if err != nil {
		panic(err)
	}
}
