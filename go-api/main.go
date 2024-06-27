package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/tbaehler/gin-keycloak/pkg/ginkeycloak"
)

func main() {
	service := os.Getenv("KEYCLOAK_SERVICE")
	url := os.Getenv("KEYCLOAK_URL")
	realm := os.Getenv("KEYCLOAK_REALM")
	api := os.Getenv("API_URL")

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
	r.GET("/chat", func(ctx *gin.Context) {
		response, err := http.Get(fmt.Sprintf("%s/chat", api))
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error making request"})
			return
		}
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error reading response"})
			return
		}
		var result []map[string]interface{}
		err = json.Unmarshal(body, &result)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error parsing response"})
			return
		}
		ctx.JSON(http.StatusOK, result)
	})
	admin := r.Group("/api/admin")
	admin.Use(ginkeycloak.NewAccessBuilder(config).
		RestrictButForRealm("admin").
		Build())

	admin.GET("/", func(c *gin.Context) {
		ginToken, _ := c.Get("token")
		token := ginToken.(ginkeycloak.KeyCloakToken)
		fmt.Println(token)
		c.JSON(http.StatusOK, gin.H{"message": "Only admin can see this"})
	})

	authenticated := r.Group("/api")
	authenticated.Use(ginkeycloak.NewAccessBuilder(config).
		RestrictButForRealm("default-roles-" + realm).
		Build())
	authenticated.DELETE("/chat/:id", func(ctx *gin.Context) {
		id := ctx.Param("id")
		req, err := http.NewRequest("DELETE", fmt.Sprintf("%s/chat/delete/%s", api, id), nil)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error creating request"})
			return
		}
		token := ctx.GetHeader("Authorization")
		req.Header.Add("Authorization", token)
		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error making request"})
			return
		}
		defer resp.Body.Close()
		// Get json from response body and return it
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error reading response"})
			return
		}
		var result map[string]interface{}
		err = json.Unmarshal(body, &result)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error parsing response"})
			return
		}
		if result["msg"] != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": result["msg"]})
			return
		}
		if resp.StatusCode != http.StatusOK {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Error deleting chat"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Deleted"})
	})
	authenticated.GET("/", func(c *gin.Context) {
		ginToken, _ := c.Get("token")
		token := ginToken.(ginkeycloak.KeyCloakToken)
		fmt.Println(token)
		c.JSON(http.StatusOK, gin.H{"message": "Authenticated but not admin"})
	})

	authenticated.GET("/user", func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "No Authorization header"})
			return
		}

		req, err := http.NewRequest("GET", fmt.Sprintf("%s/user", api), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error creating request"})
			return
		}
		req.Header.Add("Authorization", token)
		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error making request"})
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error reading response"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"username": string(body)})
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
			if role == "moderator" {
				c.JSON(http.StatusOK, gin.H{"message": "Authenticated and moderator"})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"message": "Authenticated but not admin"})
	})

	r.Run(":8081")
}
