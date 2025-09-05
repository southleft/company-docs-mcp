---
source: https://canvas.workday.com/get-started/for-developers/resources/responsive-styling
title: Responsive Styling | Workday Canvas Design System
date: 2025-08-09T14:37:54.489Z
---
##### For Developers

# Responsive Styling

## On this Page:

- [What is Responsive Styling?](#what-is-responsive-styling)
- [Container-based Responsive Styling](#container-based-responsive-styling)
- [Viewport-based Responsive Styling](#viewport-based-responsive-styling)

- [Resources](/get-started/for-developers/resources)
- Responsive Styling

## What is Responsive Styling?

Responsive styling is an approach to web development that adjusts layout and appearance based on the
device's viewport size or an element's container size.

Read more about the history of
[Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design).

### Container-based vs. Viewport-based Responsive Styling

There are two approaches to responsive styling:

1. With **container-based** styling, we measure the size of the container an element is in and apply
styles based on the size of that container. **Note** that a container's size can be affected by
surrounding containers or the viewport size.
2. With **viewport-based** styling, we measure the size of the user's viewport and apply styles
based on the size of that viewport.

Both approaches use breakpoints.

### Canvas Breakpoints

Breakpoints are the points at which the styles will change to provide an optimal user experience.
Think of a container element's or viewport's width as a range of possible sizes broken down into
buckets (e.g., `0-319px`, `320-767px`, `768-1023px`, etc).

Canvas uses the following breakpoints for both container-based and viewport-based responsive
styling:

- `zero`: styles applied from `0px` up until (but not including) `320px`
- `s`: styles applied from `320px` up until (but not including) `768px`
- `m`: styles applied from `768px` up until (but not including) `1024px`
- `l`: styles applied from `1024px` up until (but not including) `1440px`
- `xl`: styles applied from `1440px` and up

## Container-based Responsive Styling

In the interactive example below, when the dropdown's value is updated, the container size will
change to match the size shown in the dropdown.

Header

Content Left

Content Right

Footer

⚡️ Edit in Stackblitz

Show Code

`import*asReactfrom'react';import{Box,Grid,Flex}from'@workday/canvas-kit-react/layout';import{Text}from'@workday/canvas-kit-react/text';import{useResponsiveContainerStyles, useResizeObserver}from'@workday/canvas-kit-react/common';import{FormField}from'@workday/canvas-kit-react/form-field';import{Select}from'@workday/canvas-kit-react/select';
constHeadingText=({children,...props})=>(<Textas="p"fontSize={20}fontWeight="bold"color="frenchVanilla100"margin={0}{...props}>{children}</Text>);
constHeader=({children,...props})=>(<GridgridArea="Header"backgroundColor="blueberry400"{...props}>{children}</Grid>);
constContentRight=({children,...props})=>(<GridgridArea="ContentRight"backgroundColor="blueberry300"{...props}>{children}</Grid>);
constContentLeft=({children,...props})=>(<GridgridArea="ContentLeft"backgroundColor="plum300"{...props}>{children}</Grid>);
constFooter=({children,...props})=>(<GridgridArea="Footer"backgroundColor="berrySmoothie300"{...props}>{children}</Grid>);
exportdefault()=>{const ref =React.useRef(null);const[width, setWidth]=React.useState(0);
useResizeObserver({ref: ref,onResize:data=>{setWidth(data.width||0);},});
const responsiveStyles =useResponsiveContainerStyles({parentContainer:{gridGap:'s',display:'inline-grid',gridTemplateAreas:"'Header' 'ContentLeft' 'ContentRight ' 'Footer'",gridTemplateColumns:'1fr',gridTemplateRows:'auto auto auto',m:{gridTemplateAreas:"'Header Header' 'ContentLeft ContentRight ' 'Footer Footer'",gridGap:'s',gridTemplateColumns:'1fr 3fr',gridTemplateRows:'auto 200px auto',},},childrenContainers:{depth:1,borderRadius:'m',padding:'s',},box:{padding:'s',},},    width
);
const desktop =1024;
const[contWidth, setContWidth]=React.useState(desktop);
const handleChange =(event:React.ChangeEvent<HTMLInputElement>) => {// eslint-disable-next-line radixsetContWidth(parseInt(event.target.value));};
  return (
<Boxref={ref}width={contWidth}><FormField><FormField.Label>Container Size</FormField.Label><Selectitems={['1024px','768px','320px']}initialSelectedIds={['1024px']}><FormField.Inputas={Select.Input}onChange={handleChange}/><Select.Popper><Select.Card><Select.List>{item=><Select.Item>{item}</Select.Item>}</Select.List></Select.Card></Select.Popper></Select></FormField><Gridas="section"><Grid{...responsiveStyles.parentContainer}><Header{...responsiveStyles.childrenContainers}><HeadingText>Header</HeadingText></Header><ContentLeft{...responsiveStyles.childrenContainers}><HeadingText>Content Left</HeadingText></ContentLeft><ContentRight{...responsiveStyles.childrenContainers}><HeadingText>Content Right</HeadingText></ContentRight><Footer{...responsiveStyles.childrenContainers}><HeadingText>Footer</HeadingText></Footer></Grid></Grid></Box>  );
};
`This example uses the following hooks:

- `useResizeObserver` provides the width (and height) of the container.
- `useResponsiveContainerStyles` allows you to create container-based responsive styles with
objects. This hook accepts three arguments: style objects, container width, and theme (optional).
Each style object accepts keys corresponding to the following sizes: `zero`, `s`, `m`, `l` and
`xl`. These sizes represent [Canvas breakpoints](#canvas-breakpoints). The sizes act like
`min-width`. For example, if you want to apply styles from `medium` and up, then you would write
those styles under `m`.

## Viewport-based Responsive Styling

The viewport is the user's visible area of a web page (varies with screen size).

We can use media queries to run a series of tests that will measure the screen size or resolution
and apply CSS styles specifically to an element.

`@media screen and(min-width:800px){.container{margin:1em2em;}}`In the interactive example below, styles are applied based on the size of the user's viewport using
two of our breakpoint utilities: `up` and `down`. Adjust the width of your browser to see the layout
adjust to the available width.

### Header

### Small Content

### Body Content

### Footer

⚡️ Edit in Stackblitz

Show Code

`import*asReactfrom'react';import{Box,Grid}from'@workday/canvas-kit-react/layout';importstyledfrom'@emotion/styled';import{type, space, colors, borderRadius}from'@workday/canvas-kit-react/tokens';import{getTheme}from'@workday/canvas-kit-react/common';
const theme =getTheme();const{up, down}= theme.canvas.breakpoints;const small =down('m');// Returns '@media (max-width: 768px)'const medium =up('m');// Returns '@media (min-width: 768px)'const styles ={parentWrapper:{[small]:{gridTemplateAreas:"'Header' 'SmallContainer' 'BodyContent' 'Footer'",gridTemplateColumns:'1fr',gridTemplateRows:'auto',border:'10px solid',borderRadius:30,paddingLeft: space.s,paddingRight: space.s,paddingTop: space.l,paddingBottom: space.l,},[medium]:{gridTemplateAreas:"'Header Header' 'SmallContainer BodyContent' 'Footer Footer'",gridTemplateColumns:'1fr 3fr',gridTemplateRows:'auto 300px auto',border:'40px solid',borderRadius:'20px 20px 0 0',padding: space.m,},},parentContainer:{[small]:{maxWidth:'100%',},[medium]:{maxWidth:1000,},},header:{[small]:{...type.levels.body.small,...type.variants.inverse,fontWeight: type.properties.fontWeights.bold,},[medium]:{...type.levels.body.large,...type.variants.inverse,fontWeight: type.properties.fontWeights.bold,},},greyBar:{[small]:{display:'none',},[medium]:{display:'block',borderRadius:'0 0 20px 20px',},},circle:{[small]:{height:5,width:75,bottom:10,backgroundColor:'grey',},[medium]:{height:40,width:40,bottom:-95,backgroundColor:'black',},},circleTop:{[small]:{height:15,width:40,top:10,},[medium]:{display:'none',},},};
constParentCont=styled(Box.as('div'))({...styles.parentContainer,position:'relative',});
constStyledParentWrapper=styled(Grid.as('section'))({...styles.parentWrapper,gridGap: space.s,position:'relative',});
constCircleTop=styled(Box)({...styles.circleTop,backgroundColor:'black',borderRadius: borderRadius.circle,position:'absolute',left:'50%',transform:'translate(-50%, 0)',});
constStyledHeaderContainer=styled(Grid.as('div'))({gridArea:'Header',backgroundColor: colors.blueberry400,borderRadius: borderRadius.m,padding: space.s,});
constStyledLeftContent=styled(Grid.as('div'))({gridArea:'SmallContainer',backgroundColor: colors.blueberry300,borderRadius: borderRadius.m,padding: space.s,});
constStyledRightContent=styled(Grid.as('div'))({gridArea:'BodyContent',backgroundColor: colors.plum300,borderRadius: borderRadius.m,padding: space.s,});
constStyledFooterContainer=styled(Grid.as('div'))({gridArea:'Footer',backgroundColor: colors.berrySmoothie300,borderRadius: borderRadius.m,padding: space.s,});
constStyledHeading=styled(Box.as('h3'))({...styles.header,margin:0,});
constGreyBar=styled(Box)({...styles.greyBar,height:70,backgroundColor:'grey',});
constCircle=styled(Box)({...styles.circle,borderRadius: borderRadius.circle,position:'absolute',left:'50%',transform:'translate(-50%, 0)',});
exportdefault()=>{return(<ParentCont><StyledParentWrapper><CircleTop></CircleTop><StyledHeaderContainer><StyledHeading>Header</StyledHeading></StyledHeaderContainer><StyledLeftContent><StyledHeading>Small Content</StyledHeading></StyledLeftContent><StyledRightContent><StyledHeading>Body Content</StyledHeading></StyledRightContent><StyledFooterContainer><StyledHeading>Footer</StyledHeading></StyledFooterContainer><Circle></Circle></StyledParentWrapper><GreyBar></GreyBar></ParentCont>);};`### Breakpoint Utilities

We have four utilities to apply viewport-based responsive styling: `up`, `down`, `between`, and
`only`. Each has a specific role in applying viewport-based responsive styles.

#### `up`

`up` returns a media query above the `min-width` for the range of a given breakpoint. Given a
`start` breakpoint key `("zero", "s", "m", "l", "xl")`, this function returns a media query (string)
using a `min-width`. See example below.

`import{useTheme}from'@workday/canvas-kit-react/common';import{space}from'@workday/canvas-kit-react/tokens';const theme =useTheme();const{up}= theme.canvas.breakpoints;const mediaQuery =up('l');// Returns '@media (min-width: 1024px)'const styles ={[mediaQuery]:{    padding: space.m,},};`#### `down`

`down` returns a media query below the `max-width` for the range of a given breakpoint. Given an
`end` breakpoint key `("zero", "s", "m", "l", "xl")`, this function returns a media query (string)
using a `max-width`.

> **Note**: This function subtracts `0.5px` from the next breakpoint value to prevent collisions.
For example, 
> `breakpoints.values.s`, has a `min-width` of `320px`, and the `max-width` is

> `767.5px`). If the `xl` breakpoint is provided, this function returns a media query with only a

> `min-width` of `0`, as seen in the second example below.

`import{ useTheme }from'@workday/canvas-kit-react/common';import{ space }from'@workday/canvas-kit-react/tokens';*const theme =useTheme();const{ down }= theme.canvas.breakpoints;const mediaQuery =down('m');// Returns '@media (max-width: 1023.5px)'const styles ={[mediaQuery]:{    padding: space.m,}};`This example uses the `xl` breakpoint and only adds a `min-width` of `0` to the media query.

`import{useTheme}from'@workday/canvas-kit-react/common';import{space}from'@workday/canvas-kit-react/tokens';const theme =useTheme();const{down}= theme.canvas.breakpoints;const mediaQuery =down('xl');// Returns '@media (min-width: 0)'const styles ={[mediaQuery]:{    padding: space.m,},};`#### `between`

`between` returns a media query between two given breakpoints. Given `start` and `end` breakpoint
keys ("zero", "s", "m", "l", "xl"), this function returns a media query (string) using a min-width
and max-width.

> **Note**: This function subtracts `0.5px` from the next breakpoint value to prevent collisions.
For example, 
> `breakpoints.values.s`, has a `min-width` of `320px`, and the `max-width` is

> `767.5px`).

If the `xl` breakpoint is provided, this function returns a media query with only a `min-width`, as
seen in the second example below.

`import{useTheme}from'@workday/canvas-kit-react/common';import{space}from'@workday/canvas-kit-react/tokens';const theme =useTheme();const{between}= theme.canvas.breakpoints;// Returns '@media (min-width: 320px) and (max-width: 1023.5px)'const mediaQuery =between('s','m');const styles ={[mediaQuery]:{    padding: space.s,},};`This example uses `xl` as the `end` breakpoint and only adds a min-width to the media query.

`import{useTheme}from'@workday/canvas-kit-react/common';import{space}from'@workday/canvas-kit-react/tokens';const theme =useTheme();const{between}= theme.canvas.breakpoints;const mediaQuery =between('m','xl');// Returns '@media (min-width: 768px)'const styles ={[mediaQuery]:{    padding: space.s,},};`#### `only`

`only` returns a media query with a `min-width` and `max-width` for a given breakpoint. Given a
breakpoint key ("zero", "s", "m", "l", "xl"), this function returns a media query (string) using a
`min-width` and `max-width`.

> **Note**: This function subtracts `0.5px` from the next breakpoint value to prevent collisions.
For example, 
> `breakpoints.values.s`, has a `min-width` of `320px`, and the `max-width` is

> `767.5px`).

If the `xl` breakpoint is provided, this function returns a media query with only a `min-width` of
`1440px`, as seen in the second example below.

`import{useTheme}from'@workday/canvas-kit-react/common';import{space}from'@workday/canvas-kit-react/tokens';const theme =useTheme();const{only}= theme.canvas.breakpoints;const mediaQuery =only('s');// Returns '@media (min-width: 320px) and (max-width: 767.5px)'const styles ={[mediaQuery]:{    padding: space.s,},};`This example uses the `xl` breakpoint and only adds a `min-width` of `1440px` to the media query.

`import{useTheme}from'@workday/canvas-kit-react/common';import{space}from'@workday/canvas-kit-react/tokens';const theme =useTheme();const{only}= theme.canvas.breakpoints;const mediaQuery =only('xl');// Returns '@media (min-width: 1440px)'const styles ={[mediaQuery]:{    padding: space.s,},};`