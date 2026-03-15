package common

import (
	"bytes"
	"encoding/json"

	"wurenji-backend/internal/model"
)

func SafeJSONValue(raw model.JSON) interface{} {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if !json.Valid(raw) {
		return string(bytes.ToValidUTF8(raw, []byte{}))
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return string(bytes.ToValidUTF8(raw, []byte{}))
	}
	return value
}
