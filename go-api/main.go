package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/tbaehler/gin-keycloak/pkg/ginkeycloak"
)

func main() {
	service := os.Getenv("KEYCLOAK_SERVICE")
	url := os.Getenv("KEYCLOAK_URL")
	realm := os.Getenv("KEYCLOAK_REALM")

	config := ginkeycloak.BuilderConfig{
		Service:       service,
		Url:           url,
		Realm:         realm,
		FullCertsPath: nil,
	}

	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "hello world"})
	})
	secured_realm := r.Group("/api/admin")
	secured_realm.Use(ginkeycloak.NewAccessBuilder(config).
		RestrictButForRealm("admin").
		Build())

	secured_realm.GET("/", func(c *gin.Context) {
		ginToken, _ := c.Get("token")
		token := ginToken.(ginkeycloak.KeyCloakToken)
		fmt.Println(token)
		c.JSON(http.StatusOK, gin.H{"message": "Only admin can see this"})
	})

	secured_realm_no_access := r.Group("/api")
	secured_realm_no_access.Use(ginkeycloak.NewAccessBuilder(config).
		RestrictButForRealm("default-roles-" + realm).
		Build())

	secured_realm_no_access.GET("/", func(c *gin.Context) {
		ginToken, _ := c.Get("token")
		token := ginToken.(ginkeycloak.KeyCloakToken)
		fmt.Println(token)
		c.JSON(http.StatusOK, gin.H{"message": "Authenticated but not admin"})
	})

	check_admin := r.Group("/api/check")
	check_admin.Use(ginkeycloak.NewAccessBuilder(config).
		RestrictButForRealm("default-roles-" + realm).
		Build())

	check_admin.GET("/", func(c *gin.Context) {
		ginToken, _ := c.Get("token")
		token := ginToken.(ginkeycloak.KeyCloakToken)
		for _, role := range token.RealmAccess.Roles {
			if role == "admin" {
				c.JSON(http.StatusOK, gin.H{"message": "Authenticated and admin"})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"message": "Authenticated but not admin"})
	})

	r.Run(":8081")
}
