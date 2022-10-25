package urlshortener

import (
	"context"
)

type ShortenerImpl struct {
	repository Repository
}

func NewShortener(repository Repository) *ShortenerImpl {
	return &ShortenerImpl{
		repository: repository,
	}
}

func (s *ShortenerImpl) Shorten(ctx context.Context, url string) (*URL, error) {
	return &URL{}, nil // TODO: Provide implementation.
}
