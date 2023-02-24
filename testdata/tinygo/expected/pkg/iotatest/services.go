package iotatest

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/nanobus/iota/go/rx/flux"
	"github.com/nanobus/iota/go/rx/mono"
)

func SomeCalc(ctx context.Context, rhs int64, lhs int64) mono.Mono[int64] {
	// TODO: Provide implementation.
	return mono.Error[int64](errors.New("not_implemented"))
}

type MyStreamerImpl struct {
}

func NewMyStreamer(deps Dependencies) *MyStreamerImpl {
	return &MyStreamerImpl{}
}

func (m *MyStreamerImpl) RequestStreamI64(ctx context.Context) flux.Flux[int64] {
	// TODO: Provide implementation.
	return flux.Error[int64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamF64(ctx context.Context) flux.Flux[float64] {
	// TODO: Provide implementation.
	return flux.Error[float64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamType(ctx context.Context) flux.Flux[MyType] {
	// TODO: Provide implementation.
	return flux.Error[MyType](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamEnum(ctx context.Context) flux.Flux[MyEnum] {
	// TODO: Provide implementation.
	return flux.Error[MyEnum](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamUUID(ctx context.Context) flux.Flux[uuid.UUID] {
	// TODO: Provide implementation.
	return flux.Error[uuid.UUID](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamAlias(ctx context.Context) flux.Flux[MyAlias] {
	// TODO: Provide implementation.
	return flux.Error[MyAlias](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamString(ctx context.Context) flux.Flux[string] {
	// TODO: Provide implementation.
	return flux.Error[string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamBool(ctx context.Context) flux.Flux[bool] {
	// TODO: Provide implementation.
	return flux.Error[bool](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamDatetime(ctx context.Context) flux.Flux[time.Time] {
	// TODO: Provide implementation.
	return flux.Error[time.Time](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamList(ctx context.Context) flux.Flux[[]string] {
	// TODO: Provide implementation.
	return flux.Error[[]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamMap(ctx context.Context) flux.Flux[map[string]string] {
	// TODO: Provide implementation.
	return flux.Error[map[string]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsI64(ctx context.Context, value int64) flux.Flux[int64] {
	// TODO: Provide implementation.
	return flux.Error[int64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsF64(ctx context.Context, value float64) flux.Flux[float64] {
	// TODO: Provide implementation.
	return flux.Error[float64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsType(ctx context.Context, value *MyType) flux.Flux[MyType] {
	// TODO: Provide implementation.
	return flux.Error[MyType](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsEnum(ctx context.Context, value MyEnum) flux.Flux[MyEnum] {
	// TODO: Provide implementation.
	return flux.Error[MyEnum](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsUUID(ctx context.Context, value uuid.UUID) flux.Flux[uuid.UUID] {
	// TODO: Provide implementation.
	return flux.Error[uuid.UUID](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsAlias(ctx context.Context, value MyAlias) flux.Flux[MyAlias] {
	// TODO: Provide implementation.
	return flux.Error[MyAlias](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsString(ctx context.Context, value string) flux.Flux[string] {
	// TODO: Provide implementation.
	return flux.Error[string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsBool(ctx context.Context, value bool) flux.Flux[bool] {
	// TODO: Provide implementation.
	return flux.Error[bool](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsDatetime(ctx context.Context, value time.Time) flux.Flux[time.Time] {
	// TODO: Provide implementation.
	return flux.Error[time.Time](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsList(ctx context.Context, value []string) flux.Flux[[]string] {
	// TODO: Provide implementation.
	return flux.Error[[]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestStreamArgsMap(ctx context.Context, value map[string]string) flux.Flux[map[string]string] {
	// TODO: Provide implementation.
	return flux.Error[map[string]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelVoid(ctx context.Context, in flux.Flux[int64]) mono.Void {
	// TODO: Provide implementation.
	return mono.Error[struct{}](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelSingle(ctx context.Context, in flux.Flux[int64]) mono.Mono[int64] {
	// TODO: Provide implementation.
	return mono.Error[int64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelI64(ctx context.Context, in flux.Flux[int64]) flux.Flux[int64] {
	// TODO: Provide implementation.
	return flux.Error[int64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelF64(ctx context.Context, in flux.Flux[float64]) flux.Flux[float64] {
	// TODO: Provide implementation.
	return flux.Error[float64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelType(ctx context.Context, in flux.Flux[MyType]) flux.Flux[MyType] {
	// TODO: Provide implementation.
	return flux.Error[MyType](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelEnum(ctx context.Context, in flux.Flux[MyEnum]) flux.Flux[MyEnum] {
	// TODO: Provide implementation.
	return flux.Error[MyEnum](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelAlias(ctx context.Context, in flux.Flux[uuid.UUID]) flux.Flux[uuid.UUID] {
	// TODO: Provide implementation.
	return flux.Error[uuid.UUID](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelString(ctx context.Context, in flux.Flux[string]) flux.Flux[string] {
	// TODO: Provide implementation.
	return flux.Error[string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelBool(ctx context.Context, in flux.Flux[bool]) flux.Flux[bool] {
	// TODO: Provide implementation.
	return flux.Error[bool](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelDatetime(ctx context.Context, in flux.Flux[time.Time]) flux.Flux[time.Time] {
	// TODO: Provide implementation.
	return flux.Error[time.Time](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelList(ctx context.Context, in flux.Flux[[]string]) flux.Flux[[]string] {
	// TODO: Provide implementation.
	return flux.Error[[]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelMap(ctx context.Context, in flux.Flux[map[string]string]) flux.Flux[map[string]string] {
	// TODO: Provide implementation.
	return flux.Error[map[string]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsSingle(ctx context.Context, value int64, in flux.Flux[int64]) mono.Mono[int64] {
	// TODO: Provide implementation.
	return mono.Error[int64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsI64(ctx context.Context, value int64, in flux.Flux[int64]) flux.Flux[int64] {
	// TODO: Provide implementation.
	return flux.Error[int64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsF64(ctx context.Context, value float64, in flux.Flux[float64]) flux.Flux[float64] {
	// TODO: Provide implementation.
	return flux.Error[float64](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsType(ctx context.Context, value *MyType, in flux.Flux[MyType]) flux.Flux[MyType] {
	// TODO: Provide implementation.
	return flux.Error[MyType](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsEnum(ctx context.Context, value MyEnum, in flux.Flux[MyEnum]) flux.Flux[MyEnum] {
	// TODO: Provide implementation.
	return flux.Error[MyEnum](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsAlias(ctx context.Context, value uuid.UUID, in flux.Flux[uuid.UUID]) flux.Flux[uuid.UUID] {
	// TODO: Provide implementation.
	return flux.Error[uuid.UUID](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsString(ctx context.Context, value string, in flux.Flux[string]) flux.Flux[string] {
	// TODO: Provide implementation.
	return flux.Error[string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsBool(ctx context.Context, value bool, in flux.Flux[bool]) flux.Flux[bool] {
	// TODO: Provide implementation.
	return flux.Error[bool](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsDatetime(ctx context.Context, value time.Time, in flux.Flux[time.Time]) flux.Flux[time.Time] {
	// TODO: Provide implementation.
	return flux.Error[time.Time](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsList(ctx context.Context, value []string, in flux.Flux[[]string]) flux.Flux[[]string] {
	// TODO: Provide implementation.
	return flux.Error[[]string](errors.New("not_implemented"))
}

func (m *MyStreamerImpl) RequestChannelArgsMap(ctx context.Context, value map[string]string, in flux.Flux[map[string]string]) flux.Flux[map[string]string] {
	// TODO: Provide implementation.
	return flux.Error[map[string]string](errors.New("not_implemented"))
}

type MyServiceImpl struct {
	repository Repository
}

func NewMyService(deps Dependencies) *MyServiceImpl {
	return &MyServiceImpl{
		repository: deps.Repository,
	}
}

func (m *MyServiceImpl) EmptyVoid(ctx context.Context) mono.Void {
	// TODO: Provide implementation.
	return mono.Error[struct{}](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryType(ctx context.Context, value *MyType) mono.Mono[MyType] {
	// TODO: Provide implementation.
	return mono.Error[MyType](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryEnum(ctx context.Context, value MyEnum) mono.Mono[MyEnum] {
	// TODO: Provide implementation.
	return mono.Error[MyEnum](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryUUID(ctx context.Context, value uuid.UUID) mono.Mono[uuid.UUID] {
	// TODO: Provide implementation.
	return mono.Error[uuid.UUID](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryAlias(ctx context.Context, value MyAlias) mono.Mono[MyAlias] {
	// TODO: Provide implementation.
	return mono.Error[MyAlias](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryString(ctx context.Context, value string) mono.Mono[string] {
	// TODO: Provide implementation.
	return mono.Error[string](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryI64(ctx context.Context, value int64) mono.Mono[int64] {
	// TODO: Provide implementation.
	return mono.Error[int64](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryI32(ctx context.Context, value int32) mono.Mono[int32] {
	// TODO: Provide implementation.
	return mono.Error[int32](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryI16(ctx context.Context, value int16) mono.Mono[int16] {
	// TODO: Provide implementation.
	return mono.Error[int16](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryI8(ctx context.Context, value int8) mono.Mono[int8] {
	// TODO: Provide implementation.
	return mono.Error[int8](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryU64(ctx context.Context, value uint64) mono.Mono[uint64] {
	// TODO: Provide implementation.
	return mono.Error[uint64](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryU32(ctx context.Context, value uint32) mono.Mono[uint32] {
	// TODO: Provide implementation.
	return mono.Error[uint32](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryU16(ctx context.Context, value uint16) mono.Mono[uint16] {
	// TODO: Provide implementation.
	return mono.Error[uint16](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryU8(ctx context.Context, value uint8) mono.Mono[uint8] {
	// TODO: Provide implementation.
	return mono.Error[uint8](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryF64(ctx context.Context, value float64) mono.Mono[float64] {
	// TODO: Provide implementation.
	return mono.Error[float64](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryF32(ctx context.Context, value float32) mono.Mono[float32] {
	// TODO: Provide implementation.
	return mono.Error[float32](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryBytes(ctx context.Context, value []byte) mono.Mono[[]byte] {
	// TODO: Provide implementation.
	return mono.Error[[]byte](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryDatetime(ctx context.Context, value time.Time) mono.Mono[time.Time] {
	// TODO: Provide implementation.
	return mono.Error[time.Time](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryList(ctx context.Context, value []string) mono.Mono[[]string] {
	// TODO: Provide implementation.
	return mono.Error[[]string](errors.New("not_implemented"))
}

func (m *MyServiceImpl) UnaryMap(ctx context.Context, value map[string]string) mono.Mono[map[string]string] {
	// TODO: Provide implementation.
	return mono.Error[map[string]string](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncType(ctx context.Context, value *MyType, optional *MyType) mono.Mono[MyType] {
	// TODO: Provide implementation.
	return mono.Error[MyType](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncEnum(ctx context.Context, value MyEnum, optional *MyEnum) mono.Mono[MyEnum] {
	// TODO: Provide implementation.
	return mono.Error[MyEnum](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncUUID(ctx context.Context, value uuid.UUID, optional *uuid.UUID) mono.Mono[uuid.UUID] {
	// TODO: Provide implementation.
	return mono.Error[uuid.UUID](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncAlias(ctx context.Context, value MyAlias, optional *MyAlias) mono.Mono[MyAlias] {
	// TODO: Provide implementation.
	return mono.Error[MyAlias](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncString(ctx context.Context, value string, optional *string) mono.Mono[string] {
	// TODO: Provide implementation.
	return mono.Error[string](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncI64(ctx context.Context, value int64, optional *int64) mono.Mono[int64] {
	// TODO: Provide implementation.
	return mono.Error[int64](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncI32(ctx context.Context, value int32, optional *int32) mono.Mono[int32] {
	// TODO: Provide implementation.
	return mono.Error[int32](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncI16(ctx context.Context, value int16, optional *int16) mono.Mono[int16] {
	// TODO: Provide implementation.
	return mono.Error[int16](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncI8(ctx context.Context, value int8, optional *int8) mono.Mono[int8] {
	// TODO: Provide implementation.
	return mono.Error[int8](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncU64(ctx context.Context, value uint64, optional *uint64) mono.Mono[uint64] {
	// TODO: Provide implementation.
	return mono.Error[uint64](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncU32(ctx context.Context, value uint32, optional *uint32) mono.Mono[uint32] {
	// TODO: Provide implementation.
	return mono.Error[uint32](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncU16(ctx context.Context, value uint16, optional *uint16) mono.Mono[uint16] {
	// TODO: Provide implementation.
	return mono.Error[uint16](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncU8(ctx context.Context, value uint8, optional *uint8) mono.Mono[uint8] {
	// TODO: Provide implementation.
	return mono.Error[uint8](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncF64(ctx context.Context, value float64, optional *float64) mono.Mono[float64] {
	// TODO: Provide implementation.
	return mono.Error[float64](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncF32(ctx context.Context, value float32, optional *float32) mono.Mono[float32] {
	// TODO: Provide implementation.
	return mono.Error[float32](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncBytes(ctx context.Context, value []byte, optional []byte) mono.Mono[[]byte] {
	// TODO: Provide implementation.
	return mono.Error[[]byte](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncDatetime(ctx context.Context, value time.Time, optional *time.Time) mono.Mono[time.Time] {
	// TODO: Provide implementation.
	return mono.Error[time.Time](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncList(ctx context.Context, value []string, optional []string) mono.Mono[[]string] {
	// TODO: Provide implementation.
	return mono.Error[[]string](errors.New("not_implemented"))
}

func (m *MyServiceImpl) FuncMap(ctx context.Context, value map[string]string, optional map[string]string) mono.Mono[map[string]string] {
	// TODO: Provide implementation.
	return mono.Error[map[string]string](errors.New("not_implemented"))
}
