import {
  defaultGuildSettings,
  mergeGuildSettings,
} from "./guild-settings.defaults";

describe("guild settings defaults", () => {
  it("returns full shape for missing row", () => {
    const merged = mergeGuildSettings("123", null);
    expect(merged.guildId).toBe("123");
    expect(merged.notifyChannel).toBeNull();
    expect(merged.honeypotChannel).toBeNull();
    expect(merged.greetingConfig.enabled).toBe(false);
    expect(merged.farewellConfig.enabled).toBe(false);
  });

  it("serializes snowflakes as strings and synthesizes greeting config", () => {
    const merged = mergeGuildSettings("123", {
      guildId: 123n,
      averageLanguage: "ru",
      badWords: null,
      notifiedModerators: null,
      notifyChannel: 999n,
      badWordsAction: null,
      joinChannel: 555n,
      leaveChannel: null,
      postChannel: null,
      muteRole: 1n,
      autoRole: null,
      logChannel: null,
      ticketCategory: null,
      fareText: null,
      fareColor: null,
      fareImage: null,
      greetText: "hi {{mention}}",
      greetColor: "#82E868",
      greetImage: null,
      privateCrChannel: null,
      privateCategory: null,
      customGreet: null,
      customFare: null,
      notifyText: null,
      greetingConfig: null,
      farewellConfig: null,
      loggingConfig: null,
      honeypotChannel: null,
    });
    expect(merged.notifyChannel).toBe("999");
    expect(merged.muteRole).toBe("1");
    expect(merged.greetText).toBe("hi {{mention}}");
    expect(merged.averageLanguage).toBe("ru");
    expect(merged.greetingConfig.enabled).toBe(true);
    expect(merged.greetingConfig.channelId).toBe("555");
    expect(merged.greetingConfig.embeds[0]?.description).toBe("hi {{mention}}");
  });

  it("prefers JSON greeting config when present", () => {
    const merged = mergeGuildSettings("123", {
      guildId: 123n,
      averageLanguage: null,
      badWords: null,
      notifiedModerators: null,
      notifyChannel: null,
      badWordsAction: null,
      joinChannel: 1n,
      leaveChannel: null,
      postChannel: null,
      muteRole: null,
      autoRole: null,
      logChannel: null,
      ticketCategory: null,
      fareText: null,
      fareColor: null,
      fareImage: null,
      greetText: "legacy",
      greetColor: null,
      greetImage: null,
      privateCrChannel: null,
      privateCategory: null,
      customGreet: null,
      customFare: null,
      notifyText: null,
      greetingConfig: {
        enabled: true,
        channelId: "42",
        sender: "webhook",
        webhookUrl: "https://discord.com/api/webhooks/1/abc",
        content: "hello",
        embeds: [],
      },
      farewellConfig: null,
      loggingConfig: null,
      honeypotChannel: null,
    });
    expect(merged.greetingConfig.sender).toBe("webhook");
    expect(merged.greetingConfig.channelId).toBe("42");
    expect(merged.greetingConfig.content).toBe("hello");
  });

  it("defaultGuildSettings is stable", () => {
    expect(defaultGuildSettings("1")).toEqual(mergeGuildSettings("1", null));
  });
});
