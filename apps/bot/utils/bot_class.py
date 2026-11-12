import disnake
from disnake.ext.commands import AutoShardedInteractionBot, Cog
from utils import bot_logging, config, database, emojis, locales, shortcuts
from utils.metrics_flusher import MetricsFlusher
from utils.redis_client import close_redis, get_redis


class KisaBot(AutoShardedInteractionBot):
    """Custom Bot Class"""

    def __init__(self, cogs: list[str] = []) -> None:

        self.ApplicationCommandInteraction = disnake.ApplicationCommandInteraction
        self.config = config
        self.loaded_cogs: list[Cog] = []
        self.loaded_cogs_formatted = None
        self.logging = bot_logging.Logging()
        self.database = database.DatabaseManager(config.postgres_dsn)
        self.shortcuts = shortcuts
        self.custom_emojis = emojis
        self.metrics_flusher: MetricsFlusher | None = None

        intents = disnake.Intents.all()

        super().__init__(
            reload=True,
            status=disnake.Status.idle,
            intents=intents,
            enable_debug_events=True,
            proxy=config.proxy_url,
        )

        self.build_flat_files()
        self.i18n.load("translations/.flat")
        self._translation = shortcuts.Translation(self.i18n)
        self.translate = self._translation.translate

        self.cog_load(cogs)
        self.run_bot()

    def build_flat_files(self):
        locales.build_flat_files("translations")

    def reload_locales(self):
        """rebuild flat locale files and reload them into disnake i18n"""
        self.build_flat_files()
        self.i18n.reload()

    async def setup_hook(self):
        await self.database.init_schema()
        # Warm Redis connection when configured (optional cache/future use).
        await get_redis()

    def run_bot(self):
        self.logging.info(
            "Starting...", f"Proxy: {self.config.proxy_url}", type="gateway"
        )
        self.run(self.config.bot_token)

    def dictFormat(self, data, indent=0, indent_str="| "):
        result = ""
        if isinstance(data, dict):
            if not data:
                result += indent_str * indent + "None\n"

            for key, value in data.items():
                result += indent_str * indent + str(key) + ":\n"
                result += self.dictFormat(value, indent + 1, indent_str)

        elif isinstance(data, list):
            if not data:
                result += indent_str * indent + "None\n"

            for item in data:
                result += self.dictFormat(item, indent + 1, indent_str)

        else:
            result += indent_str * indent + str(data) + "\n"
        return result

    async def on_ready(self):
        self.logging.info(f"Ready as {self.user.name} ({self.user.id})", type="gateway")
        await self.setup_hook()
        self.loaded_cogs = self.cogs
        loaded = {}
        for name in self.cogs:
            cog: Cog = self.get_cog(name)
            loaded[cog.__module__] = {"commands": [], "listeners": []}
            for command in cog.__cog_app_commands__:
                loaded[command.cog.__module__]["commands"].append(
                    command.qualified_name
                )

            for listener in cog.__cog_listeners__:
                loaded[command.cog.__module__]["listeners"].append(listener[0])

        self.loaded_cogs_formatted = self.dictFormat(loaded)

        if self.metrics_flusher is None:
            self.metrics_flusher = MetricsFlusher(self)
        self.metrics_flusher.start()

    async def close(self):
        if self.metrics_flusher is not None:
            await self.metrics_flusher.stop()
        await close_redis()
        await super().close()

    async def on_disconnect(self):
        self.logging.warning("Disconnected", type="gateway")

    async def on_connect(self):
        self.logging.info("Connected", type="gateway")

    def cog_reload(self, __name__):
        """Уведомление о перезагрузке кога
        reload=True"""
        self.logging.debug("Cog reloaded", __name__, type="cogs")

    def cog_load(self, cogs: list[str]):
        self.logging.info("Cogs loading start...", type="cogs")

        for cog in cogs:
            self.logging.info(f"Cog ({cog}) load", type="cogs")
            self.load_extension(cog)
