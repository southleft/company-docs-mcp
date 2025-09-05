---
source: https://canvas.workday.com/styles/assets/system-icons
title: System Icons | Workday Canvas Design System
date: 2025-08-09T14:20:30.134Z
---
# System Icons

System Icons are symbols used to convey simple actions and functions, they are the most common icons encountered in products and help communicate metaphors at a glance.

Sources[Web GitHub](https://github.com/Workday/canvas-kit/tree/v13.2.15/modules/react/icon#system-icons)



[Web Storybook](https://workday.github.io/canvas-kit/?path=/story/tokens-icon--system-icon)



Web Install`yarn add @workday/canvas-system-icons-web`More

## On this Page:

- [Usage Guidance](#usage-guidance)
- [Universal Icons](#universal-icons)
- [Directional Icons](#directional-icons)
- [Cultural Context](#cultural-context)
- [Functionality](#functionality)
- [Alignment](#alignment)
- [Sizing](#sizing)
- [Color](#color)
- [Web Examples](#web-examples-1)

## Usage Guidance

System icons are designed to display essential characteristics that can communicate metaphors at a
glance. Some icons have specific meaning at Workday, while others are universally recognized to
display a specific function. In this section you will find guidance on the use of System icons.

## Universal Icons

Some icons are universally understood, for example, common icons like ‘home’ or ‘print’ share the
same standardized meaning in many countries and cultures. An absence of this standard can impact our
shared understanding, and we can no longer rely on the same functionality when a universal icon is
encountered.

While universal icons are rare, it is advised that these icons are used for their specific intended
purpose, below are some examples of universal icons encountered in the Canvas Design System.


      [
    
  
  ](/static/8bdc883dad6ccfe9969d64c301e0085a/07a9c/system_icon_universal_icons.png)
    

## Directional Icons

Icons are commonly used to help us navigate from page to page, being consistent with the direction
that these icons will take us in is important when we expect to be taken in the direction we choose.
If a consistent pattern is not maintained, trust is diminished. The general rule of thumb is to
point in the direction you expect to be taken.


      [
    
  
  ](/static/f2823f8f74881463c37ecef43cdec3ef/07a9c/system_icon_directional_icons.png)
    

### Bidirectionality

Some icons should be mirrored for bidirectional support so the same interpertation of an icon is
correct for languages read in different directions. Navigation icons are most commonly mirrored,
icons that deptic text, movement or interactable elements should also do this. For more info on
this, check out our article on [RTL and Bidirectionality](/guidelines/globalization/rtl-and-bidi).


      [
    
  
  ](/static/89792fc6dd2b456fd3fb4504bfc530e2/07a9c/system_icon_bidirectional.png)
    

## Cultural Context

It is important to be aware how people from other cultures may view your chosen icon. Users around
the globe may have different interpretations of what the icon represents and the action or message
the icon is trying to convey. A misinterpretation can affect someone's ability to understand the
icon’s meaning, or in certain instances, it may be viewed as offensive.

Users have several controls related to how things will be formatted and displayed within Workday:

- Language: Controls the language itself
- Locale: Controls the locale setting, like date and currency formats
- Currency: Displays the users preferred currency

It is important to keep these controls in mind when selecting icons that contain text, currency,
date, and time. Workday aims to deliver a culturally and linguistically inclusive user experience to
our 20+ million customers in over 160 countries, with more than 75% of people speaking a non-English
language.

### Web Examples


      [
    
  
  ](/static/b023220bd5d65cfedcd8d5b8b53e3220/1db73/dollar-image.png)
    


      [
    
  
  ](/static/e7b745c3e8491c893f61ef0af3aee4e4/1db73/hashmark-image.png)
    


      [
    
  
  ](/static/bb978a1be7c572eeacca7dfaee8a4918/1db73/graduation-image.png)
    

## Functionality

Icons are can be used to add an additional layer of context and recognizability to actions. In the
sections below you will find guidance for using system icons in this way.

### Using Labels

Icons must provide an equivalent text alternative for users who cannot perceive them, unless their
meaning can be derived elsewhere in text. Icons that do not communicate anything about the UI, or
have adjacent labels in text, may be considered decorative or redundant. Placing them in close
proximity to an associated task can be beneficial for those with low or partial vision. If an icon
cannot be labeled, a [Tooltip](#using-tooltips) can be used to display an icon's name or
functionality, read more about that below.


      [
    
  
  ](/static/ae0edca3f01fa60a110df8d4defe0bac/a58fe/system-labels-do.png)
    

Do

Label icons to display its name or function.


      [
    
  
  ](/static/bcfea781ce7b400b05f13e2aa003b8d3/a58fe/system-labels-caution.png)
    

Caution

When an icon cannot be labeled, use a tooltip.

### Using Tooltips

[Tooltips](/components/popups/tooltip) are used to provide additional information or context. They
should never contain information that is vital to completing a task, as this is hidden from plain
sight when tooltips are used.

Tooltips can also be used to display an icon's action (usually implemented with an
[Icon Button](/components/buttons/icon-button)). It is important to be aware that tooltips are not
easily accessible on mobile devices, so labels are preferred where possible.


      [
    
  
  ](/static/c4fdc4e9a382ebf780b47beb045dd7c9/2e9f9/system-tooltip-do.png)
    

Do

Use tooltips to provide additional information that is non-essential for completing a task.


      [
    
  
  ](/static/d58bc379c2a8dcba3770603f2a1a3cc0/480fd/system-tooltip-dont.png)
    

Don't

Hiding essential information behind a tooltip makes it harder to discover.

### Applying Touch Targets

A minimum touch target of 48px is required around a system icon to achieve a usable touch target.
This is handled automatically when you use an [Icon Button](/components/buttons/icon-button).
Smaller touch targets make interacting with an icon difficult, especially when interacted with by an
individual who may be on the move or with declining mobility.


      [
    
  
  ](/static/8490b787446e6ca0805c74e4a5050c27/07a9c/system_icon_touch_targets.png)
    

## Alignment

System icons should be center aligned vertically or horizontally depending on how they are stacked.
This ensures that icons look visually balanced when in close proximity to another icon. The same
rule should be followed when text accompanies an icon


      [
    
  
  ](/static/5753105fd7e09ed28c7c1d29d24c365a/07a9c/system_icon_alignment.png)
    

## Sizing

System icons are made to a specific standard. Changing the size of an icon will greatly diminish its
quality. Canvas does not recommend scaling icons. If for a specific reason you do need to scale an
icon we recommend following Canvas spacing rules resizing in increments of 4 pixels, never go below
20px.


      [
    
  
  ](/static/f1ee17c91c2a7adb457efbae1076a1a7/47fe2/system-sizing-caution.png)
    

Caution

Use a standard size icon whenever possible and use Canvas spacing rules to scale an icon if needed.


      [
    
  
  ](/static/60bf2fa451492ca9a79d49e868bc767c/47fe2/system-sizing-dont.png)
    

Don't

Use inconsistant sizes, always refer to Canvas spacing rules when scaling assets.

## Color

A variety of system icons can be modified to highlight specific details that you wish to call
attention to, there are 3 interactive layers where the color can be changed at an individual level.
For more information on this check out the [Layers section](#tab=create-your-own&heading=layers) in
the "Create Your Own" tab.

## Web Examples

The icons shipped in `@workday/canvas-system-icons-web` are just SVGs with some additional metadata.
If you'd like to easily use them in React, use the `SystemIcon` component from
`@workday/canvas-kit-react/icon`:

⚡️ Edit in Stackblitz

Show Code

`importReactfrom'react';import{colors}from'@workday/canvas-kit-react/tokens';import{SystemIcon}from'@workday/canvas-kit-react/icon';import{activityStreamIcon}from'@workday/canvas-system-icons-web';
exportdefault()=>(<><SystemIconicon={activityStreamIcon}/><SystemIconicon={activityStreamIcon}color={colors.blueberry500}/><SystemIconicon={activityStreamIcon}accent={colors.frenchVanilla100}fill={colors.blueberry500}background={colors.blueberry500}/><SystemIconicon={activityStreamIcon}size={48}/></>);`### Layout Component

`SystemIcon` supports all props from the`Box`layout component.

### Props

Props extend from [span](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/span). Changing the `as` prop will change the element interface.

`icon``CanvasSystemIcon`The icon to display from `@workday/canvas-system-icons-web`.

`size`` number  | string`The size of the SystemIcon in `px`.

`accent``string`The accent color of the SystemIcon. This overrides `color`.

`accentHover``string`The accent color of the SystemIcon on hover. This overrides `colorHover`.

`background``string`The background color of the SystemIcon.

`transparent``backgroundHover``string`The background color of the SystemIcon on hover.

`transparent``color``string`The color of the SystemIcon. This defines `accent` and `fill`. `color` may be overwritten by `accent` and `fill`.

`base.licorice200``colorHover``string`The hover color of the SystemIcon. This defines `accentHover` and `fillHover`. `colorHover` may be overwritten by `accentHover` and `fillHover`.

`base.licorice200``fill``string`The fill color of the SystemIcon. This overrides `color`.

`fillHover``string`The fill color of the SystemIcon on hover. This overrides `colorHover`.

`shouldMirror``boolean`If set to `true`, transform the SVG's x-axis to mirror the graphic

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

### SystemIconCircle

This is another component provided to quickly render a system icon with a colored background of your
choice.

⚡️ Edit in Stackblitz

Show Code

`importReactfrom'react';import{colors}from'@workday/canvas-kit-react/tokens';import{SystemIconCircle}from'@workday/canvas-kit-react/icon';import{activityStreamIcon}from'@workday/canvas-system-icons-web';
exportdefault()=>(<><SystemIconCircleicon={activityStreamIcon}/><SystemIconCircleicon={activityStreamIcon}background={colors.pomegranate500}/></>);`#### Props

Props extend from [span](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/span). Changing the `as` prop will change the element interface.

`background``string`The background color of the SystemIconCircle

`base.soap300``color``string`The icon color for the SystemIconCircle. Required if background specified as a CSS variable.
If not specified, it will be calculated based on the background color.

`rgba(0,0,0,0.65)``icon``CanvasSystemIcon`The icon to display from `@workday/canvas-accent-icons-web`.

`size`` SystemIconCircleSize  | number`The size of the SystemIconCircle.

`SystemIconCircleSize.l``shouldMirror``boolean`If set to `true`, transform the SVG's x-axis to mirror the graphic

`false``cs``CSToPropsInput`The `cs` prop takes in a single value or an array of values. You can pass the CSS class name
returned by `createStyles`, or the result of `createVars` and
`createModifiers`. If you're extending a component already using `cs`, you can merge that
prop in as well. Any style that is passed to the `cs` prop will override style props. If you
wish to have styles that are overridden by the `css` prop, or styles added via the `styled`
API, use `handleCsProp` wherever `elemProps` is used. If your component needs to also
handle style props, use {@link mergeStyles } instead.

`import{handleCsProp}from'@workday/canvas-kit-styling';import{mergeStyles}from'@workday/canvas-kit-react/layout';// ...// `handleCsProp` handles compat mode with Emotion's runtime APIs. `mergeStyles` has the same// function signature, but adds support for style props.return(<Element{...handleCsProp(elemProps,[     myStyles,myModifiers({ size:'medium'}),myVars({ backgroundColor:'red'})])}>{children}</Element>)``children``React.ReactNode``as``React.ElementType`Optional override of the default element used by the component. Any valid tag or Component. If you provided a Component, this component should forward the ref using `React.forwardRef`and spread extra props to a root element.

**Note:** Not all elements make sense and some elements may cause accessibility issues. Change this value with care.

`span``ref``React.Ref<R = span>`Optional ref. If the component represents an element, this ref will be a reference to the real DOM element of the component. If `as` is set to an element, it will be that element. If `as` is a component, the reference will be to that component (or element if the component uses `React.forwardRef`).