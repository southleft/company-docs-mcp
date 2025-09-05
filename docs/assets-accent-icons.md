---
source: https://canvas.workday.com/styles/assets/accent-icons
title: Accent Icons | Workday Canvas Design System
date: 2025-08-09T14:20:52.400Z
---
# Accent Icons

Accent Icons add clarity, and visual interest, they bring delight to the experience by communicating the overall tone and meaning of a page.

Sources[Web GitHub](https://github.com/Workday/canvas-kit/tree/v13.2.15/modules/react/icon#accent-icons)



[Web Storybook](https://workday.github.io/canvas-kit/?path=/story/tokens-icon--accent-icon)



Web Install`yarn add @workday/canvas-accent-icons-web`More

## On this Page:

- [Usage Guidance](#usage-guidance)
- [Color](#color)
- [Alignment](#alignment)
- [Sizing](#sizing)
- [Web Examples](#web-examples)

## Usage Guidance

Accent icons are intended to be used as simplified illustrative elements to add visual interest
without distracting your audience from their intended task. Accent icons are not intended to be
actionable, or to be used as entry points between pages.


      [
    
  
  ](/static/a2ee53b23cba13832377f75c37afee22/31493/accent-do.png)
    

Do

Use Accent Icons for illustrative purposes.


      [
    
  
  ](/static/e2c2040a9ea05b843b358086ba596462/9ff85/accent-dont.png)
    

Don't

Use Accent Icons in place of System Icons.

## Color

Accent icons are Blueberry 400 by default, though this can be overridden to other Canvas colors for
branding/theming as long as these meet a minimum contrast ratio of (3.1) or as otherwise stated by
WCAG guidelines for informational graphic contrast standards.


      [
    
  
  ](/static/90a35755b5ba3e6253818f2889486d9f/07a9c/accent_icon_color.png)
    

### Background Color

Accent icons should be recolored to pass color contrast standards when the icon is presented on a
colored or dark background.


      [
    
  
  ](/static/fcb24571c4d4afd437bf28cc9874f68c/07a9c/accent_icon_color_background.png)
    

## Alignment

Accent icons should be center aligned vertically or horizontally depending on the situation, this
ensures that the icons look visually balanced when in close proximity to another asset. When using
text next to an icon, icons should be center aligned to the text.


      [
    
  
  ](/static/0fa8b9ae236c416c8378f1a628f3767a/07a9c/accent_icon_alignment.png)
    

## Sizing

Accent icons are made to a specific standard, changing the size of an icon can cause images to blur,
Canvas does not recommend scaling icons. If for a specific reason you do need to scale an icon we
recommend following Canvas spacing rules resizing in increments of 8 pixels. Do not scale Accent
Icons below 40px.


      [
    
  
  ](/static/219d7fdfd95819c1bfc7ae4ba541e8ce/07a9c/accent_icon_scale.png)
    

## Web Examples

The icons shipped in `@workday/canvas-accent-icons-web` are just SVGs with some additional metadata.
If you'd like to easily use them in React, use the `AccentIcon` component from
`@workday/canvas-kit-react/icon`:

⚡️ Edit in Stackblitz

Show Code

`importReactfrom'react';import{colors}from'@workday/canvas-kit-react/tokens';import{AccentIcon}from'@workday/canvas-kit-react/icon';import{shieldIcon}from'@workday/canvas-accent-icons-web';
exportdefault()=>(<><AccentIconicon={shieldIcon}/><AccentIconicon={shieldIcon}color={colors.pomegranate500}/><AccentIconicon={shieldIcon}size={80}/></>);`### Layout Component

`AccentIcon` supports all props from the`Box`layout component.

### Props

Props extend from [span](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/span). Changing the `as` prop will change the element interface.

`icon``CanvasAccentIcon`The icon to display from `@workday/canvas-accent-icons-web`.

`size``number`The size of the AccentIcon in `px`.

`56``color``CanvasColorTokens`The fill color of the AccentIcon.

`base.blueberry500``transparent``boolean`If true, set the background fill of the AccentIcon to `transparent`.
If false, set the background fill of the AccentIcon to `base.frenchVanilla100`.

`false``shouldMirror``boolean`If set to `true`, transform the SVG's x-axis to mirror the graphic

`false``cs``CSToPropsInput`The `cs` prop takes in a single value or an array of values. You can pass the CSS class name
returned by `createStyles`, or the result of `createVars` and
`createModifiers`. If you're extending a component already using `cs`, you can merge that
prop in as well. Any style that is passed to the `cs` prop will override style props. If you
wish to have styles that are overridden by the `css` prop, or styles added via the `styled`
API, use `handleCsProp` wherever `elemProps` is used. If your component needs to also
handle style props, use {@link mergeStyles } instead.

`import{handleCsProp}from'@workday/canvas-kit-styling';import{mergeStyles}from'@workday/canvas-kit-react/layout';// ...// `handleCsProp` handles compat mode with Emotion's runtime APIs. `mergeStyles` has the same// function signature, but adds support for style props.return(<Element{...handleCsProp(elemProps,[     myStyles,myModifiers({ size:'medium'}),myVars({ backgroundColor:'red'})])}>{children}</Element>)``children``ReactNode``as``React.ElementType`Optional override of the default element used by the component. Any valid tag or Component. If you provided a Component, this component should forward the ref using `React.forwardRef`and spread extra props to a root element.

**Note:** Not all elements make sense and some elements may cause accessibility issues. Change this value with care.

`span``ref``React.Ref<R = span>`Optional ref. If the component represents an element, this ref will be a reference to the real DOM element of the component. If `as` is set to an element, it will be that element. If `as` is a component, the reference will be to that component (or element if the component uses `React.forwardRef`).