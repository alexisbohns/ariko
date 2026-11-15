/**
 * The staging grammar's test material (spec §8), drawn from real articles
 * rather than invented: the kosymoz workshop essay (its phone screenshot, its
 * ramps-and-tints composites, its five "In two words" asides, its
 * reduce-motion rule), the maintainer's own words from pbbls-feed-redesign,
 * and a krabs entry for the short case. Every staging test — parse,
 * serialize, render, round trip, door — runs over this one set, so a block
 * that works in one consumer and not another shows up as one fixture failing
 * in one file.
 */

const LAKE = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691293/beanstalk/cactnyq3vvr5c3qiygp9.png";
const CROMLECH = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691288/beanstalk/d8jrtpogt4p2fpacekvv.png";
const MOON = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691289/beanstalk/kacck30mkzsnt86zqifp.png";
const RAMPS = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691291/beanstalk/w0vrkms6ovvt8m5zqjly.png";
const TINTS = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691292/beanstalk/zcakvqykvboc8fx0nbxu.png";
export const CLOCK_SVG = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794700000/beanstalk/clock.svg";
export const CLOCK_DARK_SVG = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794700001/beanstalk/clock-dark.svg";

/** Valid blocks, in canonical form — serialize(parse(x)) === x for each. */
export const STAGING_FIXTURES: Record<string, string> = {
  phoneFigure: `:::figure{frame=phone}
![Two scenes framed for a phone: the lake with its two moons, and the abbey with its embers](${LAKE})
Scenes zoom in on the subject when the phone is upright.
:::`,
  desktopFigureSmall: `:::figure{frame=desktop size=s}
![The cromlech scene: standing stones, a crescent moon and a starry sky](${CROMLECH})
:::`,
  darkSvgFigure: `:::figure{size=wide dark}
![The conductor's clock driving picture, sound and haptics](${CLOCK_SVG})
![The conductor's clock, drawn for a dark page](${CLOCK_DARK_SVG})
The audio clock is the reference; *everything else* locks onto it.
:::`,
  gallery: `:::gallery
![The moon drawn with the classic ramp](${MOON} "Classic")
![The same moon in three ramps](${RAMPS} "Three ramps")
![The same moon in four tints](${TINTS} "Four tints")
One moon, drawn four ways.
:::`,
  phoneGallery: `:::gallery{frame=phone}
![The lake scene](${LAKE} "Lake")
![The cromlech scene](${CROMLECH} "Cromlech")
:::`,
  compare: `::::compare
:::do
![An almost still cromlech](${CROMLECH})
Show an almost still picture and drop the events.
:::
:::dont
![The cromlech with shooting stars](${CROMLECH})
Keep every event running and ignore the system setting.
:::
::::`,
  textOnlyCompare: `::::compare
:::do
Keep the stone lit, in the list, on the line.
:::
:::dont
Swap the stone for a flat badge to save a render.
:::
::::`,
  callout: `:::callout[In two words: dithering]
When you only have a few shades of grey to work with, you mix them in a fine pattern so the eye rebuilds the in-between tones. It is the trick of old printed newspapers and early video games.
:::`,
  calloutWithEntity: `:::callout[In two words: haptics]
The fine vibrations of the phone, timed with :entity[the music]{ref=bean:sparkaik-music}.

::entity{ref=bean:sparkaik-haptics}
:::`,
  labelWithTime: `:::callout[At 10:30, a rule]
Body.
:::`,
  unlabeledCallout: `:::callout
Deliberately left out, at least for now: multiple accounts, budgets, forecasts, accounts to log into, anything to sync.
:::`,
  quote: `:::quote{by=Alexis role="reviewing the feed explorations"}
The Spine is truly a masterclass. I think I'll only pick the realistic pebbles stones render + the 7 circles for the week in the persons of the week, both from the Stream.
:::`,
  quoteHardBreaks: `:::quote{by=Alexis}
I like the summary idea of the Journal: people of the week and raw table of\\
contents list are perfect for introducing a passed week.

I absolutely love the deck card design.
:::`,
};

/** Valid on render, but NOT canonical: the editor rewrites them on save and
 *  the render must not change. */
export const NONCANONICAL_FIXTURES: Record<string, string> = {
  defaultsSpelled: `:::figure{frame=none size=l}\n![a](${MOON})\n:::`,
  unknownValues: `:::figure{frame=tablet size=xl}\n![a](${MOON})\n:::`,
  captionOnOwnParagraph: `:::figure\n![a](${MOON})\n\nA caption after a blank line.\n:::`,
  quotedBareValue: `:::quote{by="Alexis"}\nq\n:::`,
  unclosed: `:::callout[Open]\nThis callout is never closed.`,
  interruptsParagraph: `Some prose.\n:::callout\nAn aside.\n:::`,
};

/** Malformed: remark unwraps them to their children, the editor leaves them as
 *  text, the door refuses them by name. `problem` is the door's message. */
export const MALFORMED_FIXTURES: Record<string, { md: string; problem: RegExp }> = {
  figureNoImage: { md: `:::figure\nJust words.\n:::`, problem: /figure: needs exactly one image/ },
  figureTwoImages: { md: `:::figure\n![a](${MOON})\n![b](${RAMPS})\n:::`, problem: /figure: needs exactly one image/ },
  darkOneImage: { md: `:::figure{dark}\n![a](${MOON})\n:::`, problem: /figure: dark needs two images/ },
  galleryOfOne: { md: `:::gallery\n![a](${MOON})\n:::`, problem: /gallery: needs at least two images/ },
  imageAfterCaption: { md: `:::figure\n![a](${MOON})\nCaption\n![b](${RAMPS})\n:::`, problem: /an image cannot follow the caption/ },
  headingInFigure: { md: `:::figure\n## Heading\n![a](${MOON})\n:::`, problem: /figure: only images and a caption/ },
  compareMissingDont: { md: `::::compare\n:::do\nYes.\n:::\n::::`, problem: /compare: needs one :::do and one :::dont/ },
  compareSideNoText: { md: `::::compare\n:::do\n![a](${MOON})\n:::\n:::dont\nNo.\n:::\n::::`, problem: /compare: do needs a line of text/ },
  quoteNoBy: { md: `:::quote\nWords.\n:::`, problem: /quote: by is required/ },
  emptyCallout: { md: `:::callout[Label only]\n:::`, problem: /callout: needs some text/ },
};

/** Refused by the door, though remark renders something for each. */
export const DOOR_ONLY_FIXTURES: Record<string, { md: string; problem: RegExp }> = {
  sizeXl: { md: `:::figure{size=xl}\n![a](${MOON})\n:::`, problem: /figure: size=xl is not one of s, m, l, wide/ },
  frameTablet: { md: `:::figure{frame=tablet}\n![a](${MOON})\n:::`, problem: /figure: frame=tablet is not one of phone, desktop, none/ },
  unknownAttr: { md: `:::figure{colour=red}\n![a](${MOON})\n:::`, problem: /figure: unknown attribute colour/ },
  classShorthand: { md: `:::callout{.warn}\nx\n:::`, problem: /callout: unknown attribute class/ },
  labelOnFigure: { md: `:::figure[Label]\n![a](${MOON})\n:::`, problem: /figure takes no \[label\]/ },
  nested: { md: `::::callout\nText.\n:::gallery\n![a](${MOON})\n![b](${RAMPS})\n:::\n::::`, problem: /gallery: a staged block cannot sit inside callout/ },
  doOutsideCompare: { md: `:::do\nYes.\n:::`, problem: /do: only inside ::::compare/ },
  unknownContainer: { md: `:::warning\nCareful.\n:::`, problem: /:::warning is not a staging block/ },
  leafForm: { md: `::figure{frame=phone}`, problem: /::figure must be a container/ },
  unclosed: { md: `:::callout\nNever closed.`, problem: /callout: unclosed/ },
  // remark reads each of these as a PARAGRAPH, so no directive node exists to
  // refuse and the fence renders as literal text. The first is the likeliest
  // slip of all: Docusaurus and VitePress spell an admonition title this way.
  admonitionTitle: { md: `:::callout In two words\nx\n:::`, problem: /":::callout In two words" is not a block opener/ },
  unknownWithTitle: { md: `:::note Heads up\nx\n:::`, problem: /":::note Heads up" is not a block opener/ },
  spaceBeforeBrace: { md: `:::quote {by=Alexis}\nq\n:::`, problem: /":::quote \{by=Alexis\}" is not a block opener — write :::name\[label\]\{attrs\}, with no space before \[ or \{/ },
  spaceBeforeFigureBrace: { md: `:::figure {frame=phone}\n![a](${MOON})\n:::`, problem: /is not a block opener/ },
  bareAttrs: { md: `:::figure frame=phone\n![a](${MOON})\n:::`, problem: /":::figure frame=phone" is not a block opener/ },
  missingBrace: { md: `:::figure{frame=phone\n![a](${MOON})\n:::`, problem: /":::figure\{frame=phone" is not a block opener/ },
  unclosedLabel: { md: `:::callout[In two words\nx\n:::`, problem: /":::callout\[In two words" is not a block opener/ },
  escapedQuote: { md: `:::quote{by="A \\"B\\""}\nq\n:::`, problem: /is not a block opener/ },
  strayCloser: { md: `:::callout\nx\n:::\n:::`, problem: /a stray ::: closes nothing/ },
  strayAfterCompare: { md: `${STAGING_FIXTURES.textOnlyCompare}\n::::`, problem: /a stray ::: closes nothing/ },
  closerAfterProse: { md: `Text\n:::`, problem: /a stray ::: closes nothing/ },
};

/** Not staging at all: must survive every consumer untouched. */
export const INERT_FIXTURES: Record<string, string> = {
  fenceInCode: "```md\n:::figure\n![a](https://example.com/a.png)\n:::\n```",
  inlineCode: "write `:::callout` on its own line",
  timeOfDay: "meet at 10:30 tomorrow",
};
