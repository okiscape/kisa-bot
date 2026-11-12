import {
  avatarDecorationUrl,
  avatarUrl,
  bannerUrl,
  defaultAvatarUrl,
  guildIconUrl,
} from "./discord-cdn.util";

describe("discord-cdn.util", () => {
  it("builds default avatar from snowflake", () => {
    const userId = "80351110224678912";
    const index = Number((BigInt(userId) >> 22n) % 6n);
    expect(defaultAvatarUrl(userId)).toBe(
      `https://cdn.discordapp.com/embed/avatars/${index}.png`,
    );
  });

  it("uses gif for animated avatar hashes", () => {
    expect(avatarUrl("1", "a_abc", 128)).toBe(
      "https://cdn.discordapp.com/avatars/1/a_abc.gif?size=128",
    );
  });

  it("uses png for static avatar hashes", () => {
    expect(avatarUrl("1", "abc")).toContain(".png?");
  });

  it("returns null banner/decoration when missing", () => {
    expect(bannerUrl("1", null)).toBeNull();
    expect(avatarDecorationUrl(null)).toBeNull();
    expect(guildIconUrl("1", null)).toBeNull();
  });

  it("builds decoration and guild icon URLs", () => {
    expect(avatarDecorationUrl("asset")).toBe(
      "https://cdn.discordapp.com/avatar-decoration-presets/asset.png",
    );
    expect(guildIconUrl("99", "a_icon", 64)).toBe(
      "https://cdn.discordapp.com/icons/99/a_icon.gif?size=64",
    );
  });
});
