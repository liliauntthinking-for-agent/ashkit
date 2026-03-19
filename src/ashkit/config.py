import json
import copy
from pathlib import Path
from typing import Any

CONFIG_PATH = Path("~/.ashkit/config.json").expanduser()
DEFAULT_CONFIG = {
    "providers": {},
    "channels": {
        "feishu": {
            "enabled": True,
            "app_id": "",
            "app_secret": "",
            "encrypt_key": "",
            "verification_token": "",
        }
    },
    "agents": {
        "defaults": {
            "model": "",
            "provider": "custom",
            "workspace": "~/.ashkit/workspace",
        }
    },
    "memory": {
        "l1_max_tokens": 64000,
        "l2_retention": 100,
        "l3_enabled": True,
    },
    "gateway": {
        "host": "127.0.0.1",
        "port": 38471,
    },
    "web": {
        "host": "0.0.0.0",
        "port": 47291,
    },
}


class Config:
    def __init__(self, config_path: Path | None = None):
        self.config_path = config_path or CONFIG_PATH
        self._config = copy.deepcopy(DEFAULT_CONFIG)
        self.load()

    def load(self):
        if self.config_path.exists():
            with open(self.config_path) as f:
                user_config = json.load(f)
                self._config = self._deep_merge(DEFAULT_CONFIG, user_config)

    def save(self):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            json.dump(self._config, f, indent=2)

    def _deep_merge(self, base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self._config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
            if value is None:
                return default
        return value

    def set(self, key: str, value: Any):
        keys = key.split(".")
        target = self._config
        for k in keys[:-1]:
            if k not in target:
                target[k] = {}
            target = target[k]
        target[keys[-1]] = value

    @property
    def config(self) -> dict:
        return self._config
