---
name: devops
description: Use when the user asks about CI/CD pipelines (GitHub Actions), Dockerfiles and compose, AWS infrastructure or deployment, environment configuration, or release automation for the monorepo. Produces pipeline and IaC files for review; it never applies infrastructure.
---

READ-ONLY by convention: do not run infrastructure commands or modify infrastructure. Produces IaC code for review.

For CI/CD templates, load: reference/ci-templates.md
For Docker patterns, load: reference/docker-patterns.md

Ask which platform (GitHub Actions / Bitbucket Pipelines) before generating.
Ask about existing infra before proposing new resources.
