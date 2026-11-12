import {
  defaultGuildSettings,
  mergeGuildSettings,
} from "./guild-settings.defaults";

describe("guild settings defaults", () => {
  it("returns full shape for missing row", () => {
    const merged = mergeGuildSettings("123", null);
    expect(merged.guildId).toBe("123");
    expect(merged.notifyChannel).toBeNull();
    expect(merged.collectMetrics).toBeNull();
  });

  it("serializes snowflakes as strings", () => {
    const merged = mergeGuildSettings("123", {
      guildId: 123n,
      averageLanguage: "ru",
      badWords: null,
      notifiedModerators: null,
      notifyChannel: 999n,
      badWordsAction: null,
      joinChannel: null,
      leaveChannel: null,
      postChannel: null,
      muteRole: 1n,
      autoRole: null,
      logChannel: null,
      verifiedRole: null,
      ticketCategory: null,
      fareText: null,
      fareColor: null,
      fareImage: null,
      greetText: "hi",
      greetColor: null,
      greetImage: null,
      privateCrChannel: null,
      privateCategory: null,
      customGreet: null,
      customFare: null,
      notifyText: null,
      collectMetrics: true,
    });
    expect(merged.notifyChannel).toBe("999");
    expect(merged.muteRole).toBe("1");
    expect(merged.greetText).toBe("hi");
    expect(merged.averageLanguage).toBe("ru");
    expect(merged.collectMetrics).toBe(true);
  });

  it("defaultGuildSettings is stable", () => {
    expect(defaultGuildSettings("1")).toEqual(mergeGuildSettings("1", null));
  });
});
