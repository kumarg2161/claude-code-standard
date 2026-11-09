# CI/CD Templates

## GitHub Actions — Node.js
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

## Bitbucket Pipelines — Node.js
```yaml
pipelines:
  default:
    - step:
        name: Build & Test
        image: node:20
        caches: [node]
        script:
          - npm ci
          - npm run lint
          - npm run test
          - npm run build
```

## GitHub Actions — Rust
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo clippy -- -D warnings
      - run: cargo test
      - run: cargo build --release
```

## Environment Strategy
- Dev: auto-deploy on merge to develop
- Staging: prod-mirror, deploy on merge to main
- Prod: blue/green or canary, manual approval gate
