// @vitest-environment jsdom
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Choice, configureUi, ConfirmDialog, gradeFromOffset, Meter, money, plural, simulateGrade, Tabs, TimingBar } from "../src";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(node: preact.ComponentChild) {
  const root = document.createElement("div");
  document.body.append(root);
  render(node, root);
  return root;
}

describe("components", () => {
  it("buttons fire the click sound hook and handler", () => {
    const sound = vi.fn();
    const onClick = vi.fn();
    configureUi({ click: sound });
    const root = mount(<Button onClick={onClick}>GO</Button>);
    root.querySelector("button")!.click();
    expect(sound).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
    expect(root.querySelector("button")!.className).toContain("btn primary");
  });

  it("choice chips mark the selection and report picks", () => {
    const onPick = vi.fn();
    const root = mount(<Choice value="b" options={["a", "b"]} onPick={onPick} />);
    const [a, b] = root.querySelectorAll("button");
    expect(b.getAttribute("aria-checked")).toBe("true");
    a.click();
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("tabs, meters and confirm dialogs render accessibly", () => {
    const root = mount(
      <>
        <Tabs tabs={[{ id: "home", label: "Home", badge: 3 }, { id: "shop", label: "Shop" }]} value="home" onPick={() => {}} />
        <Meter value={150} label="Fatigue" />
        <ConfirmDialog title="Sure?" text="Really" yes="YES" onYes={() => {}} onNo={() => {}} />
      </>,
    );
    expect(root.querySelector(".badge")!.textContent).toBe("3");
    expect((root.querySelector(".meter i") as HTMLElement).style.width).toBe("100%");
    expect(root.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it("formats money and plurals", () => {
    expect(money(-1234.4)).toBe("-$1,234");
    expect(money(5, "€")).toBe("€5");
    expect(plural(1, "week")).toBe("1 week");
    expect(plural(3, "match", "matches")).toBe("3 matches");
  });
});

describe("timing", () => {
  const w = { perfect: 0.1, good: 0.3, duration: 1 };
  it("grades presses by distance from the target", () => {
    expect(gradeFromOffset(0.04, w)).toBe("perfect");
    expect(gradeFromOffset(-0.12, w)).toBe("good");
    expect(gradeFromOffset(0.25, w)).toBe("poor");
    expect(gradeFromOffset(0.5, w)).toBe("whiff");
    let r = 0.5;
    expect(simulateGrade(w, 0.01, () => r)).toBe("perfect");
    r = 0;
    expect(simulateGrade(w, 0.2, () => r)).toBe("whiff");
  });

  it("the bar resolves null when cancelled", async () => {
    const bar = new TimingBar(document.body);
    const p = bar.run(w);
    bar.cancel();
    expect(await p).toBeNull();
    bar.destroy();
    expect(document.querySelector(".timing")).toBeNull();
  });
});
