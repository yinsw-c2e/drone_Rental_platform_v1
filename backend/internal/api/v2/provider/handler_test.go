package provider

import (
	"errors"
	"testing"

	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

func TestBroadcastConflictCode(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "locked by assign",
			err:  errors.Join(service.ErrBroadcastConflict, service.ErrBroadcastLockedByAssign),
			want: broadcastCodeLockedByAssign,
		},
		{
			name: "taken",
			err:  errors.Join(service.ErrBroadcastConflict, service.ErrBroadcastTakenByOther),
			want: broadcastCodeTaken,
		},
		{
			name: "status invalid",
			err:  errors.Join(service.ErrBroadcastConflict, service.ErrBroadcastStatusInvalid),
			want: broadcastCodeStatusInvalid,
		},
		{
			name: "previously cancelled",
			err:  errors.Join(service.ErrBroadcastConflict, service.ErrBroadcastPreviouslyCancelled),
			want: broadcastCodePreviouslyCancelled,
		},
		{
			name: "generic conflict fallback",
			err:  service.ErrBroadcastConflict,
			want: response.V2CodeConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := broadcastConflictCode(tt.err); got != tt.want {
				t.Fatalf("expected %s, got %s", tt.want, got)
			}
		})
	}
}
