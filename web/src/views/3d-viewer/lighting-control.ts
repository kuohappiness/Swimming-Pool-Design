import {
  withDate,
  withMinutes,
  withWeather,
  type LightingState,
} from './rendering/lighting/lighting-state';
import {
  SOLAR_TERMS,
  dateFromDayOfYear,
  dayOfYear,
  daysInYear,
  describeSolarMoment,
  type SolarMoment,
} from './rendering/lighting/solar-moment';
import { WEATHERS, WEATHER_LABELS, type Weather } from './rendering/lighting/sun-lighting';

export interface LightingControlElements {
  readonly root: HTMLElement;
  readonly date: HTMLInputElement;
  readonly dateLabel: HTMLElement;
  readonly terms: HTMLElement;
  readonly time: HTMLInputElement;
  readonly timeLabel: HTMLElement;
  readonly weather: HTMLElement;
  readonly status: HTMLElement;
  readonly now: HTMLButtonElement;
}

export interface LightingControlOptions {
  readonly elements: LightingControlElements;
  /** 使用者調了日期、時刻或天氣。 */
  readonly onChange: (state: LightingState) => void;
  /** 校址當地的現在。 */
  readonly currentMoment: () => SolarMoment;
}

/**
 * 「日照時刻」控制：日期與時刻兩條滑桿、二分二至快捷鍵、天氣切換。
 * 這裡只管畫面上的控制項；光怎麼算、怎麼套到場景由呼叫端處理。
 */
export class LightingControl {
  private readonly elements: LightingControlElements;
  private readonly options: LightingControlOptions;
  private readonly termButtons = new Map<string, HTMLButtonElement>();
  private readonly weatherButtons = new Map<Weather, HTMLButtonElement>();
  private readonly abort = new AbortController();
  private state: LightingState | null = null;

  constructor(options: LightingControlOptions) {
    this.options = options;
    this.elements = options.elements;
    const { signal } = this.abort;
    const { date, time, terms, weather, now, root } = this.elements;

    terms.replaceChildren(...SOLAR_TERMS.map((term) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = term.label;
      button.dataset.term = term.id;
      button.addEventListener('click', () => {
        if (this.state) this.options.onChange(withDate(this.state, term));
      }, { signal });
      this.termButtons.set(term.id, button);
      return button;
    }));
    weather.replaceChildren(...WEATHERS.map((id) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = WEATHER_LABELS[id];
      button.dataset.weather = id;
      button.addEventListener('click', () => {
        if (this.state) this.options.onChange(withWeather(this.state, id));
      }, { signal });
      this.weatherButtons.set(id, button);
      return button;
    }));

    date.addEventListener('input', () => {
      if (!this.state) return;
      const next = dateFromDayOfYear(this.state.moment.year, Number(date.value));
      this.options.onChange(withDate(this.state, next));
    }, { signal });
    time.addEventListener('input', () => {
      if (this.state) this.options.onChange(withMinutes(this.state, Number(time.value)));
    }, { signal });
    now.addEventListener('click', () => {
      if (this.state) this.options.onChange({ ...this.state, moment: this.options.currentMoment() });
    }, { signal });
    root.hidden = false;
  }

  /** 把控制項更新成目前的光；`description` 是太陽位置的一行說明。 */
  show(state: LightingState, description: string) {
    this.state = state;
    const { date, dateLabel, time, timeLabel, status } = this.elements;
    const text = describeSolarMoment(state.moment);
    date.max = String(daysInYear(state.moment.year));
    date.value = String(dayOfYear(state.moment));
    date.setAttribute('aria-valuetext', text.date);
    dateLabel.textContent = text.date;
    time.value = String(state.moment.minutes);
    time.setAttribute('aria-valuetext', text.time);
    timeLabel.textContent = text.time;
    status.textContent = description;
    for (const term of SOLAR_TERMS) {
      const active = term.month === state.moment.month && term.day === state.moment.day;
      const button = this.termButtons.get(term.id);
      if (!button) continue;
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
    }
    for (const [id, button] of this.weatherButtons) {
      const active = id === state.weather;
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  dispose() {
    this.abort.abort();
    this.elements.root.hidden = true;
    this.elements.terms.replaceChildren();
    this.elements.weather.replaceChildren();
    this.state = null;
  }
}
