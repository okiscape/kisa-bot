import datetime
from typing import Any, Callable

import disnake

from utils import config, emojis

TIME_UNITS: tuple[tuple[str, int], ...] = (
    ("years", 365 * 24 * 60 * 60),
    ("months", 30 * 24 * 60 * 60),
    ("week", 7 * 24 * 60 * 60),
    ("days", 24 * 60 * 60),
    ("hours", 60 * 60),
    ("minutes", 60),
    ("seconds", 1),
)


def format_duration(seconds: int, translate: Callable[[str], str]) -> str:
    """format seconds into a localized human-readable duration"""
    seconds = max(0, int(seconds))
    parts: list[str] = []

    for key, unit_seconds in TIME_UNITS:
        amount, seconds = divmod(seconds, unit_seconds)
        if amount:
            parts.append(f"{amount} {translate(f'common.time.{key}')}")

    if not parts:
        parts.append(f"0 {translate('common.time.seconds')}")

    return " ".join(parts)


def now_datetime():
    return datetime.datetime.now(config.local_tz)


def datetime_from_timestamp(timestamp: int):
    return datetime.datetime.fromtimestamp(timestamp, config.local_tz)


def rmark(text: str) -> str:
    return disnake.utils.escape_markdown(text or "")


def replace_placeholders(text: str, placeholders: dict[str, Any]) -> str:
    for key, value in placeholders.items():
        text = text.replace(key, str(value))
    return text


def build_spotify_placeholders(activity: disnake.Spotify) -> dict[str, str]:
    return {
        "{spotify.title}": activity.title,
        "{spotify.artist}": activity.artist,
        "{spotify.album}": activity.album,
        "{spotify.track_url}": activity.track_url,
        "{spotify.album_cover_url}": activity.album_cover_url,
        "{spotify.duration}": str(activity.duration),
        "{spotify.start}": str(activity.start),
        "{spotify.end}": str(activity.end),
    }


class MessageDeleteView(disnake.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @disnake.ui.button(
        emoji=emojis.icon_remove, style=disnake.ButtonStyle.secondary, row=0
    )
    async def remove_button(
        self,
        _: disnake.ui.Button,
        inter: disnake.MessageInteraction,
    ) -> None:
        await inter.message.delete()


def generate_autocomplete_choices(choices: list[str]):
    async def returned(inter, string: str) -> list[str]:
        string = string.lower()
        return [lang for lang in choices if string in lang.lower()]

    return returned


async def get_time_in_timezone(offset: int):
    utc_now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=offset
    )
    return utc_now


def generate_pick(choices: list[str]):
    return generate_autocomplete_choices(choices)


class Translation:
    def __init__(self, i18n: disnake.LocalizationProtocol):
        self.i18n = i18n

    def translate(
        self,
        inter: disnake.ApplicationCommandInteraction | disnake.ModalInteraction,
        key: str,
        **kwargs,
    ) -> str:
        text = self.i18n.get(key)
        if not text:
            return f"{{{key}}}"

        # fall back to English while other locales are not available yet
        after = text.get(inter.locale.value) or text.get("en-US")
        if not after:
            return f"{{{key}}}"

        return str(after.format(**kwargs) if kwargs else after)
