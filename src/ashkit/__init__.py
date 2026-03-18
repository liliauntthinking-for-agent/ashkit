#!/usr/bin/env python3
import asyncio
import argparse
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Ashkit - Lightweight AI Assistant")
    parser.add_argument("--config", type=str, help="Path to config file")
    parser.add_argument("--workspace", type=str, help="Path to workspace directory")
    parser.add_argument("command", nargs="?", default="gateway", help="Command to run")
    args = parser.parse_args()

    from ashkit.config import Config

    config = Config(Path(args.config) if args.config else None)

    if args.workspace:
        config.set("agents.defaults.workspace", args.workspace)

    if args.command == "gateway":
        asyncio.run(run_gateway(config))
    elif args.command == "agent":
        asyncio.run(run_agent(config))
    elif args.command == "web":
        run_web(config)
    else:
        print(f"Unknown command: {args.command}")


def run_web(config):
    from ashkit.web import app
    import uvicorn

    host = config.get("web.host", "0.0.0.0")
    port = config.get("web.port", 47291)
    uvicorn.run(app, host=host, port=port)


async def run_gateway(config):
    from ashkit.gateway import Gateway

    gateway = Gateway(config)
    try:
        await gateway.start()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        await gateway.stop()


async def run_agent(config):
    from ashkit.agent import Agent
    from pathlib import Path

    workspace = Path(
        config.get("agents.defaults.workspace", "~/.ashkit/workspace")
    ).expanduser()
    agent = Agent(agent_id="cli", config=config.config, workspace=workspace)

    print("Ashkit CLI Agent. Type 'quit' to exit.")
    while True:
        try:
            user_input = input("\nYou: ")
            if user_input.lower() in ["quit", "exit"]:
                break

            response = await agent.process_message("cli", user_input)
            print(f"\nAssistant: {response}")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    main()
