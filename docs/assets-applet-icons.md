---
source: https://canvas.workday.com/styles/assets/applet-icons
title: Applet Icons | Workday Canvas Design System
date: 2025-08-09T14:21:20.426Z
---
# Applet Icons

Applet Icons convey entry points, categories of actions, or information sources on the Workday homepage.

Sources[Web GitHub](https://github.com/Workday/canvas-kit/tree/v13.2.15/modules/react/icon#applet-icons)



[Web Storybook](https://workday.github.io/canvas-kit/?path=/story/tokens-icon--applet-icon)



Web Install`yarn add @workday/canvas-applet-icons-web`More

## On this Page:

- [Usage Guidance](#usage-guidance)
- [Color](#color)
- [Labeling](#labeling)
- [Sizing](#sizing)
- [Alignment](#alignment)
- [Web Examples](#web-examples)
- [AppletIcon.Colors](#appleticon.colors-api)

## Usage Guidance

Applet Icons act as the brand or logo of a product, service or tool, they convey the core concept of
the products that they depict. Applet icons should be used to specifically convey entry points to
related products and services. They should never be used as standard icons as this can impact an
individual's understanding or trust of a product's entry point when misused.

## Color

Applet icons can be themed to match the color of Workday customer branding (Blueberry by default).
Rather than specifying a specific color, a shade level (100-600) is assigned for each layer.
Depending on which color is selected, the icon will automatically update all layers to the various
shades of that color. Do not override any layers within an Applet icon to a specific color, as this
will break the theming support. For more information, check out the
[Layers section](#tab=create-your-own&heading=layers) on the "Create Your Own" tab.


      [
    
  
  ](/static/e18aef8b3b60c425423b49f711d7120b/07a9c/applet_icon_color.png)
    

## Labeling

Labels should always accompany Applet icons to reinforce and make clear to an individual which entry
point they are seeking out.

## Sizing

Applet icons are made to a specific standard, changing the size of an icon can cause anti-aliasing
issues. Canvas does not recommend scaling applet icons. If for a specific reason you do need to
scale an icon we recommend following Canvas spacing rules resizing in increments of 8 pixels.


      [
    
  
  ](/static/e8f09cc19c0a98dbd592c585e2e962e0/07a9c/applet_icon_sizing.png)
    

## Alignment

App icons should be center aligned vertically or horizontally depending on the situation. This
ensures that the icons look visually balanced when in close proximity to another asset. Text should
also be center aligned to an app icon.


      [
    
  
  ](/static/199b2b64f5d173032d3079cfb268cb14/07a9c/applet_icon_alignment.png)
    

## Web Examples

The icons shipped in `@workday/canvas-applet-icons-web` are just SVGs with some additional metadata.
If you'd like to easily use them in React, use the `AppletIcon` component from
`@workday/canvas-kit-react/icon`:

⚡️ Edit in Stackblitz

Show Code

`importReactfrom'react';import{AppletIcon}from'@workday/canvas-kit-react/icon';import{benefitsIcon}from'@workday/canvas-applet-icons-web';
exportdefault()=>(<><AppletIconicon={benefitsIcon}/><AppletIconicon={benefitsIcon}color={AppletIcon.Colors.Pomegranate}/><AppletIconicon={benefitsIcon}size={60}/></>);`### Props

Props extend from [span](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/span). Changing the `as` prop will change the element interface.

`icon``CanvasAppletIcon`The icon to display from `@workday/canvas-applet-icons-web`.

`size``number`The size of the AppletIcon in `px`.

`92``color``BrandingColor`The icon color hue. Must use a member of the `AppletIcon.Colors` static enum.

`AppletIcon.Colors.Blueberry``shouldMirror``boolean`If set to `true`, transform the SVG's x-axis to mirror the graphic

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

## AppletIcon.Colors

`Cinnamon``'cinnamon'``Peach``'peach'``ChiliMango``'chiliMango'``Cantaloupe``'cantaloupe'``SourLemon``'sourLemon'``JuicyPear``'juicyPear'``Kiwi``'kiwi'``GreenApple``'greenApple'``Watermelon``'watermelon'``Jewel``'jewel'``Toothpaste``'toothpaste'``Blueberry``'blueberry'``Plum``'plum'``BerrySmoothie``'berrySmoothie'``Blackberry``'blackberry'``IslandPunch``'islandPunch'``GrapeSoda``'grapeSoda'``Pomegranate``'pomegranate'``FruitPunch``'fruitPunch'``RootBeer``'rootBeer'``ToastedMarshmallow``'toastedMarshmallow'``Cappuccino``'cappuccino'``Licorice``'licorice'``BlackPepper``'blackPepper'`