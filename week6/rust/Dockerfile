# ---- Stage 1: build (large image with the Rust toolchain) ----
FROM rust:1.82-slim AS builder
WORKDIR /build
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

# ---- Stage 2: runtime (small image, just the binary) ----
FROM debian:bookworm-slim
RUN useradd --system --no-create-home appuser
COPY --from=builder /build/target/release/rust-service /usr/local/bin/rust-service
USER appuser
EXPOSE 8000
CMD ["rust-service"]
