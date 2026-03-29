# Health checks:
# - Docker health checks use 'wget' (available in Alpine/BusyBox by default)
# - Makefile health target uses 'curl' (typically available on host machines)
.PHONY: down up health

down:
	docker compose down

up:
	docker compose up -d

health:
	@echo "Checking API health..."
	@curl -sf http://localhost:3001/health > /dev/null && echo "✓ API: OK" || echo "✗ API: FAILED"
	@echo "Checking Web health..."
	@curl -sf http://localhost:3000/ > /dev/null && echo "✓ Web: OK" || echo "✗ Web: FAILED"
