---
source: https://canvas.workday.com/get-started/for-developers/resources/style-props#border
title: Style Props | Workday Canvas Design System
date: 2025-08-09T14:34:37.238Z
---
##### For Developers

# Style Props

## On this Page:

- [System Prop Values](#system-prop-values)
- [Background](#background)
- [Border](#border)
- [Color](#color)
- [Depth](#depth)
- [Flex](#flex)
- [Flex Item](#flex-item)
- [Grid](#grid)
- [Grid Item](#grid-item)
- [Layout](#layout)
- [Other](#other)
- [Position](#position)
- [Space](#space)
- [Text](#text)

- [Resources](/get-started/for-developers/resources)
- Style Props

Style props provide a common, ergonomic API for modifying a component's styles by passing styles
with props.

### Caution: Performance Hit

As we transition away from Emotion's runtime costs, we advise against using style props. Please use our[styling utilities]()



instead. For more information on this change, view our discussion on the[Future of Styling]()



.## System Prop Values

Many style props are design-system-aware and translate `SystemPropValues` for you automatically. In
the example below, the `padding` prop translates the value `s` to `16px` and `frenchVanilla100` to
`#ffffff`. These `SystemPropValues` are also included in our types, so your IDE's intellisense
should suggest these values as you work. This allows you to use Canvas design tokens fluidly without
disrupting your workflow.

`<Boxpadding="s"backgroundColor="frenchVanilla100">Hello, style props!</Box>`There are seven types of system prop values: `color`, `depth`, `font`, `fontSize`, `fontWeight`,
`shape`, and `space` — corresponding to our Canvas design tokens. Each style prop section below
includes a table. The "System" column in that table will tell you which system prop values are
supported.

## Background

Background style props allow you to adjust the background styles of components.

Cinnamon 300Sour Lemon 300Blueberry 300⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',display:'inline-block',margin:'xxs',minHeight:'xl',minWidth:'8rem',padding:'xs',};
exportdefault()=>{return(<div><BoxbackgroundColor="cinnamon300"{...baseStyles}>        Cinnamon 300
</Box><BoxbackgroundColor="sourLemon300"{...baseStyles}>        Sour Lemon 300
</Box><BoxbackgroundColor="blueberry300"{...baseStyles}>        Blueberry 300
</Box></div>);};`[background](https://developer.mozilla.org/en-US/docs/Web/CSS/background)



[background-attachment](https://developer.mozilla.org/en-US/docs/Web/CSS/background-attachment)



[background-color](https://developer.mozilla.org/en-US/docs/Web/CSS/background-color)



[background-image](https://developer.mozilla.org/en-US/docs/Web/CSS/background-image)



[background-position](https://developer.mozilla.org/en-US/docs/Web/CSS/background-position)



[background-repeat](https://developer.mozilla.org/en-US/docs/Web/CSS/background-repeat)



[background-size](https://developer.mozilla.org/en-US/docs/Web/CSS/background-size)



## Border

Border style props allow you to adjust the border styles of components.

Cinnamon 300Sour Lemon 300Blueberry 300⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper300',display:'inline-block',margin:'xxs',minHeight:'xl',minWidth:'8rem',padding:'xs',};
exportdefault()=>(<div><BoxborderRadius="m"border="solid 4px"borderColor="cinnamon300"{...baseStyles}>      Cinnamon 300
</Box><BoxborderRadius="m"border="solid 4px"borderColor="sourLemon300"{...baseStyles}>      Sour Lemon 300
</Box><BoxborderRadius="m"border="solid 4px"borderColor="blueberry300"{...baseStyles}>      Blueberry 300
</Box></div>);`[border](https://developer.mozilla.org/en-US/docs/Web/CSS/border)



[border-bottom](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom)



[border-bottom-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-color)



[border-bottom-left-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-left-radius)



[border-bottom-right-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-right-radius)



[border-bottom-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-style)



[border-bottom-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-width)



[border-collapse](https://developer.mozilla.org/en-US/docs/Web/CSS/border-collapse)



[border-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-color)



[border-inline-end](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-end)



[border-inline-end-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-end-color)



[border-inline-end-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-end-style)



[border-inline-end-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-end-width)



[border-inline-start](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-start)



[border-inline-start-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-start-color)



[border-inline-start-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-start-style)



[border-inline-start-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-start-width)



[border-left](https://developer.mozilla.org/en-US/docs/Web/CSS/border-left)



[border-left-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-left-color)



[border-left-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-left-style)



[border-left-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-left-width)



[border-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius)



[border-right](https://developer.mozilla.org/en-US/docs/Web/CSS/border-right)



[border-right-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-right-color)



[border-right-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-right-style)



[border-right-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-right-width)



[border-spacing](https://developer.mozilla.org/en-US/docs/Web/CSS/border-spacing)



[border-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-style)



[border-top](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top)



[border-top-color](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-color)



[border-top-left-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-left-radius)



[border-top-right-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-right-radius)



[border-top-style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-style)



[border-top-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-width)



[border-width](https://developer.mozilla.org/en-US/docs/Web/CSS/border-width)



## Color

Color style props allow you to adjust the color styles of components.

Cinnamon 300Sour Lemon 300Blueberry 300⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
const baseStyles ={display:'inline-block',margin:'xxs',minHeight:'xl',minWidth:'8rem',padding:'xs',};
exportdefault()=>(<div><BoxbackgroundColor="cinnamon300"color="blackPepper500"{...baseStyles}>      Cinnamon 300
</Box><BoxbackgroundColor="sourLemon300"color="blackPepper500"{...baseStyles}>      Sour Lemon 300
</Box><BoxbackgroundColor="blueberry300"color="blackPepper500"{...baseStyles}>      Blueberry 300
</Box></div>);`[background-color](https://developer.mozilla.org/en-US/docs/Web/CSS/background-color)



[color](https://developer.mozilla.org/en-US/docs/Web/CSS/color)



[opacity](https://developer.mozilla.org/en-US/docs/Web/CSS/opacity)



## Depth

Depth style props allow you to adjust the depth styles of components.

Depth 1Depth 2Depth 3⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',display:'inline-block',margin:'xxs',minHeight:'xl',minWidth:'8rem',padding:'xs',};
exportdefault()=>(<div><BoxbackgroundColor="cinnamon300"depth={1}{...baseStyles}>      Depth 1
</Box><BoxbackgroundColor="sourLemon300"depth={2}{...baseStyles}>      Depth 2
</Box><BoxbackgroundColor="blueberry300"depth={3}{...baseStyles}>      Depth 3
</Box></div>);`[box-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)



[box-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)



## Flex

Flex style props allow you to adjust the flex styles of components.

111222111⚡️ Edit in Stackblitz

Show Code

`import{Flex}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',minHeight:'xl',minWidth:'2rem',padding:'xs',};
exportdefault()=>(<FlexcolumnGap="xs"><FlexflexDirection="column"rowGap="xs"flex={1}><Flex.ItembackgroundColor="cinnamon300"textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="sourLemon300"textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="blueberry300"textAlign="center"{...baseStyles}>        1
</Flex.Item></Flex><FlexflexDirection="column"rowGap="xs"flex={2}><Flex.ItembackgroundColor="cinnamon300"textAlign="center"{...baseStyles}>        2
</Flex.Item><Flex.ItembackgroundColor="sourLemon300"textAlign="center"{...baseStyles}>        2
</Flex.Item><Flex.ItembackgroundColor="blueberry300"textAlign="center"{...baseStyles}>        2
</Flex.Item></Flex><FlexflexDirection="column"rowGap="xs"flex={1}><Flex.ItembackgroundColor="cinnamon300"textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="sourLemon300"textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="blueberry300"textAlign="center"{...baseStyles}>        1
</Flex.Item></Flex></Flex>);`[align-content](https://developer.mozilla.org/en-US/docs/Web/CSS/align-content)



[align-items](https://developer.mozilla.org/en-US/docs/Web/CSS/align-items)



[column-gap](https://developer.mozilla.org/en-US/docs/Web/CSS/column-gap)



[display](https://developer.mozilla.org/en-US/docs/Web/CSS/display)



[flex-direction](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-direction)



[flex-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap)



[gap](https://developer.mozilla.org/en-US/docs/Web/CSS/gap)



[justify-content](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content)



[justify-items](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-items)



[row-gap](https://developer.mozilla.org/en-US/docs/Web/CSS/row-gap)



## Flex Item

Flex item style props allow you to adjust the flex item styles of components.

12121211⚡️ Edit in Stackblitz

Show Code

`import{Flex}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',minHeight:'xl',minWidth:'2rem',padding:'xs',};
exportdefault()=>(<FlexflexDirection="column"rowGap="xs"><FlexcolumnGap="xs"><Flex.ItembackgroundColor="cinnamon300"flex={1}textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="sourLemon300"flex={2}textAlign="center"{...baseStyles}>        2
</Flex.Item><Flex.ItembackgroundColor="blueberry300"flex={1}textAlign="center"{...baseStyles}>        1
</Flex.Item></Flex><FlexcolumnGap="xs"><Flex.ItembackgroundColor="cinnamon300"flex={2}textAlign="center"{...baseStyles}>        2
</Flex.Item><Flex.ItembackgroundColor="sourLemon300"flex={1}textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="blueberry300"flex={2}textAlign="center"{...baseStyles}>        2
</Flex.Item></Flex><FlexcolumnGap="xs"><Flex.ItembackgroundColor="cinnamon300"flex={1}textAlign="center"{...baseStyles}>        1
</Flex.Item><Flex.ItembackgroundColor="blueberry300"flex={1}textAlign="center"{...baseStyles}>        1
</Flex.Item></Flex></Flex>);`[align-self](https://developer.mozilla.org/en-US/docs/Web/CSS/align-self)



[flex](https://developer.mozilla.org/en-US/docs/Web/CSS/flex)



[flex-basis](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-basis)



[flex-grow](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-grow)



[flex-shrink](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink)



[justify-self](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-self)



[order](https://developer.mozilla.org/en-US/docs/Web/CSS/order)



## Grid

Grid style props allow you to adjust the grid styles of components.

⚡️ Edit in Stackblitz

Show Code

`import{Grid}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',padding:'xs',};
exportdefault()=>(<GridgridGap="xs"gridTemplateAreas="'head head''nav main''nav foot'"gridTemplateColumns="1fr 3fr"gridTemplateRows="2.5rem minmax(10rem, auto) 2.5rem"><Grid.ItemgridArea="head"backgroundColor="cinnamon300"{...baseStyles}/><Grid.ItemgridArea="nav"backgroundColor="sourLemon300"{...baseStyles}/><Grid.ItemgridArea="main"backgroundColor="blueberry300"{...baseStyles}/><Grid.ItemgridArea="foot"backgroundColor="cinnamon300"{...baseStyles}/></Grid>);`[align-content](https://developer.mozilla.org/en-US/docs/Web/CSS/align-content)



[align-items](https://developer.mozilla.org/en-US/docs/Web/CSS/align-items)



[display](https://developer.mozilla.org/en-US/docs/Web/CSS/display)



[grid](https://developer.mozilla.org/en-US/docs/Web/CSS/grid)



[grid-area](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-area)



[grid-auto-columns](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-columns)



[grid-auto-flow](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-flow)



[grid-auto-rows](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-rows)



[grid-column-gap](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column-gap)



[grid-gap](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-gap)



[grid-place-items](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-place-items)



[grid-row-gap](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row-gap)



[grid-template](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template)



[grid-template-areas](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-areas)



[grid-template-columns](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns)



[grid-template-rows](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows)



[justify-content](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content)



[justify-items](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-items)



## Grid Item

Grid item style props allow you to adjust the grid item styles of components.

⚡️ Edit in Stackblitz

Show Code

`import{Grid}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',padding:'xs',};
exportdefault()=>(<GridgridGap="xs"gridTemplateColumns="1fr 3fr"gridTemplateRows="2.5rem minmax(10rem, auto) 2.5rem"><Grid.ItemgridColumn="1 / 3"gridRow="1"backgroundColor="cinnamon300"{...baseStyles}/><Grid.ItemgridColumn="1"gridRow="2 / 4"backgroundColor="sourLemon300"{...baseStyles}/><Grid.ItemgridColumn="2"gridRow="2"backgroundColor="blueberry300"{...baseStyles}/><Grid.ItemgridColumn="2"gridRow="3"backgroundColor="cinnamon300"{...baseStyles}/></Grid>);`[align-self](https://developer.mozilla.org/en-US/docs/Web/CSS/align-self)



[grid-area](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-area)



[grid-column](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column)



[grid-column-end](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column-end)



[grid-column-start](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column-start)



[grid-row](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row)



[grid-row-end](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row-end)



[grid-row-start](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row-start)



[justify-self](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-self)



[place-self](https://developer.mozilla.org/en-US/docs/Web/CSS/place-self)



## Layout

Layout style props allow you to adjust the layout styles of components.

40 x 8064 x 8080 x 80⚡️ Edit in Stackblitz

Show Code

`import{Flex}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',margin:'xxs',padding:'xs',justifyContent:'center',alignItems:'flex-start',};
exportdefault()=>(<FlexalignItems="flex-end"><FlexbackgroundColor="cinnamon300"display="inline-flex"height="xl"width="xxxl"{...baseStyles}>      40 x 80
</Flex><FlexbackgroundColor="sourLemon300"display="inline-flex"height="xxl"width="xxxl"{...baseStyles}>      64 x 80
</Flex><FlexbackgroundColor="blueberry300"display="inline-flex"height="xxxl"width="xxxl"{...baseStyles}>      80 x 80
</Flex></Flex>);`[display](https://developer.mozilla.org/en-US/docs/Web/CSS/display)



[height](https://developer.mozilla.org/en-US/docs/Web/CSS/height)



[list-style](https://developer.mozilla.org/en-US/docs/Web/CSS/list-style)



[max-height](https://developer.mozilla.org/en-US/docs/Web/CSS/max-height)



[max-width](https://developer.mozilla.org/en-US/docs/Web/CSS/max-width)



[min-height](https://developer.mozilla.org/en-US/docs/Web/CSS/min-height)



[min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width)



[overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)



[overflow-x](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-x)



[overflow-y](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-y)



[vertical-align](https://developer.mozilla.org/en-US/docs/Web/CSS/vertical-align)



[width](https://developer.mozilla.org/en-US/docs/Web/CSS/width)



## Other

Other style props allow you to adjust the other, miscellaneous styles of components.

Cursor GrabCursor TextCursor Wait⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';import{colors}from'@workday/canvas-kit-react/tokens';
const baseStyles ={color:'blackPepper500',display:'inline-block',margin:'xxs',minHeight:'xl',padding:'xs',};
exportdefault()=>(<Box><BoxbackgroundColor="cinnamon300"cursor="grab"outline={`2px dashed ${colors.cinnamon300}`}outlineOffset="2px"{...baseStyles}>      Cursor Grab
</Box><BoxbackgroundColor="sourLemon300"cursor="text"outline={`2px dashed ${colors.sourLemon300}`}outlineOffset="2px"{...baseStyles}>      Cursor Text
</Box><BoxbackgroundColor="blueberry300"cursor="wait"outline={`2px dashed ${colors.blueberry300}`}outlineOffset="2px"{...baseStyles}>      Cursor Wait
</Box></Box>);`[animation](https://developer.mozilla.org/en-US/docs/Web/CSS/animation)



[appearance](https://developer.mozilla.org/en-US/docs/Web/CSS/appearance)



[box-sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing)



[content](https://developer.mozilla.org/en-US/docs/Web/CSS/content)



[cursor](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor)



[fill](https://developer.mozilla.org/en-US/docs/Web/CSS/fill)



[float](https://developer.mozilla.org/en-US/docs/Web/CSS/float)



[object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)



[object-position](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position)



[outline](https://developer.mozilla.org/en-US/docs/Web/CSS/outline)



[outline-offset](https://developer.mozilla.org/en-US/docs/Web/CSS/outline-offset)



[overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap)



[pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)



[resize](https://developer.mozilla.org/en-US/docs/Web/CSS/resize)



[stroke](https://developer.mozilla.org/en-US/docs/Web/CSS/stroke)



[transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)



[transition](https://developer.mozilla.org/en-US/docs/Web/CSS/transition)



[user-select](https://developer.mozilla.org/en-US/docs/Web/CSS/user-select)



[visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)



## Position

Position style props allow you to adjust the position styles of components.

LeftCenterRight⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
const baseStyles ={color:'blackPepper500',margin:'xxs',height:'xl',width:'8rem',padding:'xs',};
exportdefault()=>{return(<div><BoxbackgroundColor="cinnamon300"left={0}position="absolute"top="calc(50% - 20px)"zIndex={1}textAlign="center"{...baseStyles}>        Left
</Box><BoxbackgroundColor="sourLemon300"left={`calc(50% - 4rem)`}position="absolute"top="calc(50% - 20px)"zIndex={2}textAlign="center"{...baseStyles}>        Center
</Box><BoxbackgroundColor="blueberry300"position="absolute"right={0}top="calc(50% - 20px)"zIndex={3}textAlign="center"{...baseStyles}>        Right
</Box></div>);};`[bottom](https://developer.mozilla.org/en-US/docs/Web/CSS/bottom)



[inset](https://developer.mozilla.org/en-US/docs/Web/CSS/inset)



[inset-inline-end](https://developer.mozilla.org/en-US/docs/Web/CSS/inset-inline-end)



[inset-inline-start](https://developer.mozilla.org/en-US/docs/Web/CSS/inset-inline-start)



[left](https://developer.mozilla.org/en-US/docs/Web/CSS/left)



[position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)



[right](https://developer.mozilla.org/en-US/docs/Web/CSS/right)



[top](https://developer.mozilla.org/en-US/docs/Web/CSS/top)



[z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)



## Space

Space style props allow you to adjust the space styles of components.

SmallMediumLarge⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
const baseStyles ={border:'dotted 2px',color:'blackPepper500',display:'inline-block',verticalAlign:'bottom',};
exportdefault()=>(<div><BoxbackgroundColor="cinnamon300"margin="xxs"padding="s"textAlign="center"{...baseStyles}><Boxborder="dotted 2px"borderColor="blackPepper500">        Small
</Box></Box><BoxbackgroundColor="sourLemon300"margin="xxs"padding="m"textAlign="center"{...baseStyles}><Boxborder="dotted 2px"borderColor="blackPepper500">        Medium
</Box></Box><BoxbackgroundColor="blueberry300"margin="xxs"padding="l"textAlign="center"{...baseStyles}><Boxborder="dotted 2px"borderColor="blackPepper500">        Large
</Box></Box></div>);`[margin](https://developer.mozilla.org/en-US/docs/Web/CSS/margin)



[margin-bottom](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-bottom)



[margin-inline-end](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-inline-end)



[margin-inline-start](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-inline-start)



[margin-left](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-left)



[margin-right](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-right)



[margin-top](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-top)



[margin-left](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-left)



[margin-right](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-right)



[margin-top](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-top)



[margin-bottom](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-bottom)



[padding](https://developer.mozilla.org/en-US/docs/Web/CSS/padding)



[padding-bottom](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-bottom)



[padding-inline-end](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-inline-end)



[padding-inline-start](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-inline-start)



[padding-left](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-left)



[padding-right](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-right)



[padding-top](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-top)



[padding-left](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-left)



[padding-right](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-right)



[padding-top](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-top)



[padding-bottom](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-bottom)



## Text

Text style props allow you to adjust the text styles of components.

### The Elements of Typographic Style

"Typography is the craft of endowing human language with a durable visual form."

― Robert Bringhurst

⚡️ Edit in Stackblitz

Show Code

`import{Box}from'@workday/canvas-kit-react/layout';
exportdefault()=>(<Boxpadding="m"border="solid 4px"borderColor="blueberry300"color="blackPepper500"><Boxas="h3"fontSize="large"fontWeight="bold"margin="zero">      The Elements of Typographic Style
</Box><Boxas="p"fontSize="medium"fontStyle="italic">      "Typography is the craft of endowing human language with a durable visual form."
</Box><Boxas="span"fontSize="small"fontWeight="bold"color="licorice300">      ― Robert Bringhurst
</Box></Box>);`[font-family](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family)



[font-size](https://developer.mozilla.org/en-US/docs/Web/CSS/font-size)



[font-style](https://developer.mozilla.org/en-US/docs/Web/CSS/font-style)



[font-weight](https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight)



[letter-spacing](https://developer.mozilla.org/en-US/docs/Web/CSS/letter-spacing)



[line-height](https://developer.mozilla.org/en-US/docs/Web/CSS/line-height)



[text-align](https://developer.mozilla.org/en-US/docs/Web/CSS/text-align)



[text-decoration](https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration)



[text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow)



[text-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-shadow)



[text-transform](https://developer.mozilla.org/en-US/docs/Web/CSS/text-transform)



[white-space](https://developer.mozilla.org/en-US/docs/Web/CSS/white-space)



[word-break](https://developer.mozilla.org/en-US/docs/Web/CSS/word-break)