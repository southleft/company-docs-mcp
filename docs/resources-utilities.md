---
source: https://canvas.workday.com/get-started/for-developers/resources/styling/utilities
title: Styling Utilities | Workday Canvas Design System
date: 2025-08-09T14:38:29.779Z
---
##### For Developers

# Styling Utilities

## On this Page:

- [Pixels to Rem](#pixels-to-rem)
- [Calc Functions](#calc-functions)
- [keyframes](#keyframes)
- [injectGlobal](#injectglobal)
- [Custom Emotion Instance](#custom-emotion-instance)

- [Resources](/get-started/for-developers/resources)
- Styling

A collection of helpful functions for styling with `@workday/canvas-kit-styling`. While they're
fairly simple, they make styling much nicer.

## Pixels to Rem

This function converts a `px` value (number) to `rem` (string). This keeps you from having to do any
tricky mental division or write irrational numbers.

`import{px2rem}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';const styles ={// returns '0.0625rem'  margin:px2rem(1),};`## Calc Functions

Calc functions are useful for doing basic math operations with CSS `calc()` and variables. They will
also wrap variables automatically in `var()`.

### Add

This function returns a CSS `calc()` addition string.

`import{calc}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';const styles ={// returns 'calc(var(--cnvs-sys-space-x1) + 0.125rem)'  padding: calc.add(system.space.x1,'0.125rem'),};`### Subtract

This function returns a CSS `calc()` subtraction string.

`import{calc}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';const styles ={// returns 'calc(var(--cnvs-sys-space-x1) - 0.125rem)'  padding: calc.subtract(system.space.x1,'0.125rem'),};`### Multiply

This function returns a CSS `calc()` multiplication string.

`import{calc}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';const styles ={// returns 'calc(var(--cnvs-sys-space-x1) * 3)'  padding: calc.multiply(system.space.x1,3),};`### Divide

This function returns a CSS `calc()` division string

`import{calc}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';const styles ={// returns 'calc(var(--cnvs-sys-space-x1) / 2)'  padding: calc.divide(system.space.x1,2),};`### Negate

This function negates a CSS variable to give you the opposite value. This keeps you from having to
wrap the variable in `calc()` and multiplying by `-1`.

`import{calc}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';const styles ={// returns 'calc(var(--cnvs-sys-space-x4) * -1)'  margin: calc.negate(system.space.x4),};`## keyframes

The `keyframes` function re-exports the [Emotion CSS keyframes](https://emotion.sh/docs/keyframes)
function, but is compatible with a custom Emotion instance and is understood by the Static style
transformer.

### Example

`import{system}from'@workday/canvas-tokens-web';import{createComponent}from'@workday/canvas-kit-react/common';import{  handleCsProp,  keyframes,  createStencil,  calc,  px2rem,CSProps,}from'@workday/canvas-kit-styling';/** * Keyframe for the dots loading animation. */const keyframesLoading =keyframes({'0%, 80%, 100%':{    transform:'scale(0)',},'40%':{    transform:'scale(1)',},});exportconst loadingStencil =createStencil({  base:{    display:'inline-flex',    gap: system.space.x2,    width: system.space.x4,    height: system.space.x4,    fontSize: system.space.zero,    borderRadius: system.shape.round,    backgroundColor: system.color.bg.muted.softer,    outline:`${px2rem(2)} solid transparent`,    transform:'scale(0)',    animationName: keyframesLoading,    animationDuration: calc.multiply('150ms',35),    animationIterationCount:'infinite',    animationTimingFunction:'ease-in-out',    animationFillMode:'both',},});/** * A simple component that displays three horizontal dots, to be used when some data is loading. */exportconstLoadingDot=createComponent('div')({  displayName:'LoadingDots',Component:({...elemProps}: CSProps, ref, Element)=>{return<Element ref={ref}{...handleCsProp(elemProps,loadingStencil())}></Element>;},});`## injectGlobal

The `injectGlobal` function re-exports the
[Emotion CSS injectGlobal](https://emotion.sh/docs/@emotion/css#global-styles) function, but is
compatible with a custom Emotion instance and is understood by the Static style transformer. It will also wrap our CSS tokens to ensure you can inject global styles using our CSS variables.

`injectGlobal({...fonts,'html, body':{    fontFamily: system.fontFamily.default,    margin:0,    minHeight:'100vh',...system.type.heading.large,},'#root, #root < div':{    minHeight:'100vh',},});`### Example

`import{createRoot}from'react-dom/client';import{fonts}from'@workday/canvas-kit-react-fonts';import{system}from'@workday/canvas-tokens-web';import{cssVar, injectGlobal}from'@workday/canvas-kit-styling';import{App}from'./App';import'@workday/canvas-tokens-web/css/base/_variables.css';import'@workday/canvas-tokens-web/css/brand/_variables.css';import'@workday/canvas-tokens-web/css/system/_variables.css';//@ts-ignoreinjectGlobal({...fonts,'html, body':{    fontFamily:cssVar(system.fontFamily.default),    margin:0,    minHeight:'100vh',},'#root, #root < div':{    minHeight:'100vh',...system.type.body.small,},});const container =document.getElementById('root')!;const root =createRoot(container);root.render(<App/>);`## Custom Emotion Instance

Static style injection happens during the parsing stages of the files. This means when you `import`
a component that uses static styling, the styles are injected immediately. This happens way before
rendering, so using the Emotion [CacheProvider](https://emotion.sh/docs/cache-provider) does not
work. A custom instance must be created *before* any style utilities are called - during the
bootstrapping phase of an application. We don't have a working example because it requires an
isolated application, but here's an example adding a `nonce` to an application:

`// bootstrap-styles.tsimport{createInstance}from'@workday/canvas-kit-styling';// assuming this file is being called via a `script` tag and that// script tag has a `nonce` attribute set from the servercreateInstance({nonce:document.currentScript.nonce});// index.tsimportReactfrom'react';importReactDOMfrom'react-dom';// call the bootstrap in the import list. This has the side-effect// of creating an instanceimport'./bootstrap-styles';importAppfrom'./App';const root =ReactDOM.createRoot(document.querySelector('#root'));root.render(<App/>);// App.tsximportReactfrom'react';// The following will create and inject styles. We cannot adjust// the Emotion instance after this importimport{PrimaryButton}from'@workday/canvas-kit-react/button';// if we call `createInstance` here, we'll get a warning in// development modeexportdefault()=>{return<PrimaryButton>Button</PrimaryButton>;};`