import sys
import importlib.util
sys.path[:0] = ['/tmp/berlin-testdeps', '/tmp/berlin-terrain-integration', '/app']
import src.publications.service
spec = importlib.util.spec_from_file_location('src.publications.service', '/tmp/berlin-terrain-integration/service.py')
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
src.publications.service = module
import pytest
raise SystemExit(pytest.main(['/tmp/berlin-terrain-integration/test_production_publications.py', '/tmp/berlin-terrain-integration/test_berlin_terrain.py', '-q', '-p', 'no:cacheprovider']))
