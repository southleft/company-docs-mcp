---
source: https://canvas.workday.com/get-started/for-developers/resources/combobox
title: Combobox | Workday Canvas Design System
date: 2025-08-09T14:37:22.622Z
---
##### For Developers

# Combobox

## On this Page:

- [Examples](#examples)
- [Component API](#component-api)
- [Model](#combobox-model-api)
- [Hooks](#hooks)

- [Resources](/get-started/for-developers/resources)
- Combobox

Combobox is an *abstract* compound component - it should not be used on its own, but used as a base
to create combobox components. The Combobox system provides components, models, loaders, and
elemProps hooks.

The term "Combobox" is based on the
[Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) as defined in the ARIA
Authoring Practices Guide (APG):

> A [combobox](https://w3c.github.io/aria/#combobox) is an input widget with an associated popup
that enables users to select a value for the combobox from a collection of possible values.
> 

Examples of a "combobox" would be date pickers, autocomplete, and select components.

## Examples

### Autocomplete

This example shows an Autocomplete example using `FormField`, `InputGroup`, and the `Combobox`
components to make an autocomplete form field. It uses [useComboboxLoader](#usecomboboxloader) to
make mock API calls using `setTimeout`. Your application may use
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API),
[WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API), or other means of
communicating with a server.

An Autocomplete is an example of an arbitrary combobox.

⚡️ Edit in Stackblitz

Show Code

`importReactfrom'react';
import{  createElemPropsHook,  createSubcomponent,  composeHooks,}from'@workday/canvas-kit-react/common';import{LoadReturn}from'@workday/canvas-kit-react/collection';import{Combobox,  useComboboxModel,  useComboboxLoader,  useComboboxInput,  useComboboxInputArbitrary,}from'@workday/canvas-kit-react/combobox';import{FormField}from'@workday/canvas-kit-react/form-field';import{StyledMenuItem}from'@workday/canvas-kit-react/menu';import{LoadingDots}from'@workday/canvas-kit-react/loading-dots';import{InputGroup,TextInput}from'@workday/canvas-kit-react/text-input';import{createStencil, px2rem}from'@workday/canvas-kit-styling';import{system}from'@workday/canvas-tokens-web';
const colors =['Red','Blue','Purple','Green','Pink'];const fruits =['Apple','Orange','Banana','Grape','Lemon','Lime'];const options =Array(1000).fill('').map((_, index)=>{return`${colors[index % colors.length]}${fruits[index % fruits.length]}${index +1}`;});
const useAutocompleteInput =composeHooks(createElemPropsHook(useComboboxModel)(model=>{return{onKeyPress(event:React.KeyboardEvent){        model.events.show(event);},};}),  useComboboxInputArbitrary,  useComboboxInput
);
const loadingDotsStencil =createStencil({base:{transition:'opacity 100ms ease','& [data-part="loading-dots"]':{display:'flex',transform:'scale(0.3)',},},modifiers:{isLoading:{true:{opacity: system.opacity.full,},false:{opacity: system.opacity.zero,},},},});
constAutoCompleteInput=createSubcomponent(TextInput)({modelHook: useComboboxModel,elemPropsHook: useAutocompleteInput,})<{isLoading?: boolean}>(({isLoading,...elemProps},Element)=>{return(<InputGroup><InputGroup.Inputas={Element}{...elemProps}/><InputGroup.InnerEndcs={loadingDotsStencil({isLoading})}width={px2rem(20)}data-loading={isLoading}><LoadingDotsdata-part="loading-dots"/></InputGroup.InnerEnd><InputGroup.InnerEnd><InputGroup.ClearButtondata-testid="clear"/></InputGroup.InnerEnd></InputGroup>);});
exportdefault()=>{const{model, loader}=useComboboxLoader({// You can start with any number that makes sense.total:0,
// Pick whatever number makes sense for your APIpageSize:20,
// A load function that will be called by the loader. You must return a promise that returns// an object like `{items: [], total: 0}`. The `items` will be merged into the loader's cacheasyncload({pageNumber, pageSize, filter}){returnnewPromise<LoadReturn<string>>(resolve => {// simulate a server response by resolving after a period of timesetTimeout(()=>{// simulate paging and filtering based on pre-computed itemsconst start =(pageNumber -1)* pageSize;const end = start + pageSize;const filteredItems = options.filter(item=>{if(filter ===''||typeof filter !=='string'){returntrue;}return item.toLowerCase().includes(filter.toLowerCase());});
const total = filteredItems.length;const items = filteredItems.slice(start, end);
resolve({              items,              total,});},300);});
      },
      onShow() {// The `shouldLoad` cancels while the combobox menu is hidden, so let's load when it is// visible        loader.load();},
    },
    useComboboxModel
  );
  return (
<FormFieldorientation="horizontalStart"isRequired><FormField.Label>Fruit</FormField.Label><FormField.Field><Comboboxmodel={model}onChange={event=>console.log('input', event.currentTarget.value)}><FormField.Inputas={AutoCompleteInput}isLoading={loader.isLoading}/><Combobox.Menu.Popper><Combobox.Menu.Card>{model.state.items.length===0&&(<StyledMenuItemas="span">No Results Found</StyledMenuItem>)}{model.state.items.length>0&&(<Combobox.Menu.ListmaxHeight={px2rem(200)}>{item=><Combobox.Menu.Item>{item}</Combobox.Menu.Item>}</Combobox.Menu.List>)}</Combobox.Menu.Card></Combobox.Menu.Popper></Combobox></FormField.Field></FormField>  );
};
`### Custom Styles

Combobox and its subcomponents support custom styling via the `cs` prop. For more information, check
our
["How To Customize Styles"](https://workday.github.io/canvas-kit/?path=/docs/styling-how-to-customize-styles--docs).

## Component API

### Combobox

#### Props

Props extend from ComboboxModelConfig. If a `model` is passed, props from `ComboboxModelConfig` are ignored.

`children``ReactNode`Children of the `Combobox`. Should contain a `Combobox.Input` and a `Combobox.Menu`

`model``ComboboxModel`Optional model to pass to the component. This will override the default model created for the component. This can be useful if you want to access to the state and events of the model, or if you have nested components of the same type and you need to override the model provided by React Context.

`elemPropsHook``(  model: ComboboxModel,   elemProps: TProps) => HTML Attributes`Optional hook that receives the model and all props to be applied to the element. If you use this, it is your responsibility to return props, merging as appropriate. For example, returning an empty object will disable all elemProps hooks associated with this component. This allows finer control over a component without creating a new one.

### Combobox.Input

The input of the `Combobox`. This element will have `role="combobox"` applied, along with
`aria-haspopup="true"`

#### Props

Props extend from TextInput. Changing the `as` prop will change the element interface.

`error``ErrorType`The type of error associated with the TextInput (if applicable).

`width`` number  | string`The width of the TextInput.

`grow``boolean`True if the component should grow to its container's width. False otherwise.

`cs``CSToPropsInput`The `cs` prop takes in a single value or an array of values. You can pass the CSS class name
returned by `createStyles`, or the result of `createVars` and
`createModifiers`. If you're extending a component already using `cs`, you can merge that
prop in as well. Any style that is passed to the `cs` prop will override style props. If you
wish to have styles that are overridden by the `css` prop, or styles added via the `styled`
API, use `handleCsProp` wherever `elemProps` is used. If your component needs to also
handle style props, use {@link mergeStyles } instead.

`import{handleCsProp}from'@workday/canvas-kit-styling';import{mergeStyles}from'@workday/canvas-kit-react/layout';// ...// `handleCsProp` handles compat mode with Emotion's runtime APIs. `mergeStyles` has the same// function signature, but adds support for style props.return(<Element{...handleCsProp(elemProps,[     myStyles,myModifiers({ size:'medium'}),myVars({ backgroundColor:'red'})])}>{children}</Element>)``children``React.ReactNode``as``React.ElementType`Optional override of the default element used by the component. Any valid tag or Component. If you provided a Component, this component should forward the ref using `React.forwardRef`and spread extra props to a root element.

**Note:** Not all elements make sense and some elements may cause accessibility issues. Change this value with care.

`TextInput``ref``React.Ref<R = TextInput>`Optional ref. If the component represents an element, this ref will be a reference to the real DOM element of the component. If `as` is set to an element, it will be that element. If `as` is a component, the reference will be to that component (or element if the component uses `React.forwardRef`).

`model``ComboboxModel`Optional model to pass to the component. This will override the default model created for the component. This can be useful if you want to access to the state and events of the model, or if you have nested components of the same type and you need to override the model provided by React Context.

`elemPropsHook``(  model: ComboboxModel,   elemProps: TProps) => HTML Attributes`Optional hook that receives the model and all props to be applied to the element. If you use this, it is your responsibility to return props, merging as appropriate. For example, returning an empty object will disable all elemProps hooks associated with this component. This allows finer control over a component without creating a new one.

#### useComboboxInput

`useComboboxInput` Adds all attributes necessary to start with a `Combobox.Input`. It opens the
menu with arrow keys, uses `useListActiveDescendant`, and handles keyboard arrows to
navigate items of the menu. You may also compose this hook to add more specific behaviors for
your `Combobox.Input`.

`composeHooks(  createElemPropsHook(    model: ComboboxModel,     elemProps: {},     ref: React.Ref  ) => {    onKeyDown: (event: React.KeyboardEvent) => void;    onBlur: (event: React.FocusEvent) => void;    onClick: (event: React.MouseEvent) => void;    value:  string  | undefined;    role: 'combobox';    aria-haspopup: 'listbox';    aria-expanded: boolean;    aria-autocomplete: 'list';    aria-controls: any;    aria-activedescendant:  null  | undefined;    id: string;    ref: (instance:  T  | null) => void;  },   useSetPopupWidth,   useComboboxInputOpenWithArrowKeys,   useListActiveDescendant,   useComboboxListKeyboardHandler,   usePopupTarget)`### Combobox.Menu

A custom {@link Menu } component that uses `aria-activedescendant` instead of roving tab index
to keep the focus on the `ComboboxInputCombobox.Input`.

#### Props

`children``ReactNode`Children of the `ComboboxMenuCombobox.Menu`.

`model``ComboboxModel`Optional model to pass to the component. This will override the default model created for the component. This can be useful if you want to access to the state and events of the model, or if you have nested components of the same type and you need to override the model provided by React Context.

`elemPropsHook``(  model: ComboboxModel,   elemProps: TProps) => HTML Attributes`Optional hook that receives the model and all props to be applied to the element. If you use this, it is your responsibility to return props, merging as appropriate. For example, returning an empty object will disable all elemProps hooks associated with this component. This allows finer control over a component without creating a new one.

### Combobox.Menu.Popper

The "Popper" of a `ComboboxMenuCombobox.Menu`. The popper will appear around the
`Combobox.Input`. It renders a `div` element that is portalled to the
`document.body` which is controlled by the {@link PopupStack }. The `PopupStack` is not part
of React. This means no extra props given to this component will be forwarded to the `div`
element, but the `ref` will be forwarded. Also fallback placements for the popper with be either `top` or `bottom`.

#### Props

Props extend from [div](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/div). Changing the `as` prop will change the element interface.

`anchorElement`` React.RefObject<Element>  | Element  | null`The reference element used to position the Popper. Popper content will try to follow the
`anchorElement` if it moves and will reposition itself if there is no longer room in the
window.

`children`` ((props: {    placement: Placement;  }) => ReactNode)  | ReactNode`The content of the Popper. If a function is provided, it will be treated as a Render Prop and
pass the `placement` chosen by PopperJS. This `placement` value is useful if your popup needs
to animate and that animation depends on the direction of the content in relation to the
`anchorElement`.

`getAnchorClientRect``() => DOMRect`When provided, this optional callback will be used to determine positioning for the Popper element
instead of calling `getBoundingClientRect` on the `anchorElement` prop. Use this when you need
complete control over positioning. When this prop is specified, it is safe to pass `null` into the
`anchorElement` prop. If `null` is passed into the `anchorElement` prop, an `owner` will not be
provided for the `PopupStack`.

`open``boolean`Determines if `Popper` content should be rendered. The content only exists in the DOM when
`open` is `true`

`true``placement``Placement`The placement of the `Popper` contents relative to the `anchorElement`. Accepts `auto`, `top`,
`right`, `bottom`, or `left`. Each placement can also be modified using any of the following
variations: `-start` or `-end`.

`bottom``fallbackPlacements``Placement[]`Define fallback placements by providing a list of `Placement` in array (in order of preference).
The default preference is following the order of `top`, `right`, `bottom`, and `left`. Once the initial
and opposite placements are not available, the fallback placements will be in use. Use an empty array to
disable the fallback placements.

`onPlacementChange``(placement: Placement) => void`A callback function that will be called whenever PopperJS chooses a placement that is different
from the provided `placement` preference. If a `placement` preference doesn't fit, PopperJS
will choose a new one and call this callback.

`popperOptions``Partial<PopperOptions>`The additional options passed to the Popper's `popper.js` instance.

`portal``boolean`If false, render the Popper within the
DOM hierarchy of its parent. A non-portal Popper will constrained by the parent container
overflows. If you set this to `false`, you may experience issues where you content gets cut off
by scrollbars or `overflow: hidden`

`true``popperInstanceRef``Ref<Instance>`Reference to the PopperJS instance. Useful for making direct method calls on the popper
instance like `update`.

`as``React.ElementType`Optional override of the default element used by the component. Any valid tag or Component. If you provided a Component, this component should forward the ref using `React.forwardRef`and spread extra props to a root element.

**Note:** Not all elements make sense and some elements may cause accessibility issues. Change this value with care.

`div``ref``React.Ref<R = div>`Optional ref. If the component represents an element, this ref will be a reference to the real DOM element of the component. If `as` is set to an element, it will be that element. If `as` is a component, the reference will be to that component (or element if the component uses `React.forwardRef`).

`model``MenuModel`Optional model to pass to the component. This will override the default model created for the component. This can be useful if you want to access to the state and events of the model, or if you have nested components of the same type and you need to override the model provided by React Context.

`elemPropsHook``(  model: MenuModel,   elemProps: TProps) => HTML Attributes`Optional hook that receives the model and all props to be applied to the element. If you use this, it is your responsibility to return props, merging as appropriate. For example, returning an empty object will disable all elemProps hooks associated with this component. This allows finer control over a component without creating a new one.

#### usePopupPopper

Adds the necessary props to a {@link Popper } component. Used by the
`Popup.Popper` subcomponent.

`createElemPropsHook(  model: PopupModel,   elemProps: {},   ref: React.Ref) => {  open: boolean;  anchorElement: RefObject<HTMLButtonElement>;  ref: (instance:  T  | null) => void;  onPlacementChange: (placement: Placement) => void;}`### Combobox.Menu.List

The combobox menu list follows the Collections API. A list can either contain static items or
a render prop and `items` to the model.

`constMyComponent=()=>{const model =useComboboxModel({    items:['First Item','Second Item']})return(<Comboboxmodel={model}>// other combobox subcomponents<Combobox.Menu.List>{(item)=><Combobox.Menu.Item>{item}</Combobox.Menu.Item>}</Combobox.Menu.List></Combobox>)}`#### Layout Component

`Combobox.Menu.List` supports all props from the`Flex`layout component.

#### Props

Props extend from [ul](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ul). Changing the `as` prop will change the element interface.

`children`` ReactNode  | ((    item: T,     index: number  ) => ReactNode)``marginTop``   undefined    | number    | string & {}    | 's'    | 'zero'    | 'm'    | 'l'    | 'xxxs'    | 'xxs'    | 'xs'    | 'xl'    | 'xxl'    | 'xxxl'`Set the margin top of the list box. You must use this prop and not style any other way. The
`Menu` uses virtualization and needs margins to be set on the correct element. This ensure
proper rendering. If a `marginTop` is not provided, the value falls back to `marginY`.

`marginBottom``   undefined    | number    | string & {}    | 's'    | 'zero'    | 'm'    | 'l'    | 'xxxs'    | 'xxs'    | 'xs'    | 'xl'    | 'xxl'    | 'xxxl'`Set the margin bottom of the list box. You must use this prop and not style any other way. The
`Menu` uses virtualization and needs margins to be set on the correct element. This ensure
proper rendering. If a `marginBottom` is not provided, the value falls back to `marginY`.

`marginY``   undefined    | number    | string & {}    | 's'    | 'zero'    | 'm'    | 'l'    | 'xxxs'    | 'xxs'    | 'xs'    | 'xl'    | 'xxl'    | 'xxxl'`Set the margin top and bottom of the list box. You must use this prop and not style any other way. The
`Menu` uses virtualization and needs margins to be set on the correct element. This ensure
proper rendering.

`cs``CSToPropsInput`The `cs` prop takes in a single value or an array of values. You can pass the CSS class name
returned by `createStyles`, or the result of `createVars` and
`createModifiers`. If you're extending a component already using `cs`, you can merge that
prop in as well. Any style that is passed to the `cs` prop will override style props. If you
wish to have styles that are overridden by the `css` prop, or styles added via the `styled`
API, use `handleCsProp` wherever `elemProps` is used. If your component needs to also
handle style props, use {@link mergeStyles } instead.

`import{handleCsProp}from'@workday/canvas-kit-styling';import{mergeStyles}from'@workday/canvas-kit-react/layout';// ...// `handleCsProp` handles compat mode with Emotion's runtime APIs. `mergeStyles` has the same// function signature, but adds support for style props.return(<Element{...handleCsProp(elemProps,[     myStyles,myModifiers({ size:'medium'}),myVars({ backgroundColor:'red'})])}>{children}</Element>)``as``React.ElementType`Optional override of the default element used by the component. Any valid tag or Component. If you provided a Component, this component should forward the ref using `React.forwardRef`and spread extra props to a root element.

**Note:** Not all elements make sense and some elements may cause accessibility issues. Change this value with care.

`ul``ref``React.Ref<R = ul>`Optional ref. If the component represents an element, this ref will be a reference to the real DOM element of the component. If `as` is set to an element, it will be that element. If `as` is a component, the reference will be to that component (or element if the component uses `React.forwardRef`).

`model``ComboboxModel`Optional model to pass to the component. This will override the default model created for the component. This can be useful if you want to access to the state and events of the model, or if you have nested components of the same type and you need to override the model provided by React Context.

`elemPropsHook``(  model: ComboboxModel,   elemProps: TProps) => HTML Attributes`Optional hook that receives the model and all props to be applied to the element. If you use this, it is your responsibility to return props, merging as appropriate. For example, returning an empty object will disable all elemProps hooks associated with this component. This allows finer control over a component without creating a new one.

#### useComboboxMenuList

The `listbox` uses `aria-labelledby` pointing to the `Combobox.Input`. This
input should be labelled by a form field label for proper accessibility. Use {@link FormField } to
ensure proper accessibility.

`createElemPropsHook(  model: MenuModel,   elemProps: {},   ref: React.Ref) => {  role: 'listbox';  aria-labelledby: string;  id: any;}`### Combobox.Menu.Card

`Combobox.Menu.Card` is a non-semantic element used to give the dropdown menu its distinct visual
cue that the dropdown menu is floating above other content. `Combobox.Menu.Card` usually contains a
`Combobox.Menu.List`, but it can also contain other elements like a header or footer.

#### Layout Component

`Combobox.Menu.Card` supports all props from the`Box`layout component.

#### Props

Props extend from [div](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/div). Changing the `as` prop will change the element interface.

`children``ReactNode`Children of the Card. Should contain a `<Card.Body>` and an optional `<Card.Heading>`

`cs``CSToPropsInput`The `cs` prop takes in a single value or an array of values. You can pass the CSS class name
returned by `createStyles`, or the result of `createVars` and
`createModifiers`. If you're extending a component already using `cs`, you can merge that
prop in as well. Any style that is passed to the `cs` prop will override style props. If you
wish to have styles that are overridden by the `css` prop, or styles added via the `styled`
API, use `handleCsProp` wherever `elemProps` is used. If your component needs to also
handle style props, use {@link mergeStyles } instead.

`import{handleCsProp}from'@workday/canvas-kit-styling';import{mergeStyles}from'@workday/canvas-kit-react/layout';// ...// `handleCsProp` handles compat mode with Emotion's runtime APIs. `mergeStyles` has the same// function signature, but adds support for style props.return(<Element{...handleCsProp(elemProps,[     myStyles,myModifiers({ size:'medium'}),myVars({ backgroundColor:'red'})])}>{children}</Element>)``as``React.ElementType`Optional override of the default element used by the component. Any valid tag or Component. If you provided a Component, this component should forward the ref using `React.forwardRef`and spread extra props to a root element.

**Note:** Not all elements make sense and some elements may cause accessibility issues. Change this value with care.

`div``ref``React.Ref<R = div>`Optional ref. If the component represents an element, this ref will be a reference to the real DOM element of the component. If `as` is set to an element, it will be that element. If `as` is a component, the reference will be to that component (or element if the component uses `React.forwardRef`).

`model``ComboboxModel`Optional model to pass to the component. This will override the default model created for the component. This can be useful if you want to access to the state and events of the model, or if you have nested components of the same type and you need to override the model provided by React Context.

`elemPropsHook``(  model: ComboboxModel,   elemProps: TProps) => HTML Attributes`Optional hook that receives the model and all props to be applied to the element. If you use this, it is your responsibility to return props, merging as appropriate. For example, returning an empty object will disable all elemProps hooks associated with this component. This allows finer control over a component without creating a new one.

#### useComboboxCard

This hook sets the `minWidth` style attribute to match the width of the
`Combobox.Input` component.

`createElemPropsHook(  model: ComboboxModel,   elemProps: {},   ref: React.Ref) => {  minWidth: number;}`## Model

### useComboboxModel

`ComboboxModel` extends the {@link ListModel } and the {@link InputModel }. Selecting items from
the menu will dispatch an
[input](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/input_event) event on the
input which should work with form libraries, automation, and autofill.

`const model =useComboboxModel()<Comboboxmodel={model}>{Combobox child components}</Combobox>``useComboboxModel (config: ComboboxModelConfig): ComboboxModel`## Hooks

### useComboboxLoader

Creates a `Combobox` data loader and a model. The `Combobox` loader extends the
`useListLoader` and connects a `Combobox.Input` to the filter of the
data loader. A simple loader using
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) could look like the
following:

`const{model, loader}=useComboboxLoader({    total:0,    pageSize:20,asyncload({pageNumber, pageSize, filter}){// `filter` will be a `string`returnfetch(`/myUrl?filter=${filter}`).then(response => response.json()).then(response =>{return{total: response.total, items: response.items};});},},  useComboboxModel);``useListLoader`### useComboboxInputConstrained

A constrained combobox input can only offer values that are part of the provided list of `items`.
The default is an unconstrained. A constrained input should have both a form input that is hidden
from the user as well as a user input that will be visible to the user. This hook is in charge of
keeping the inputs and the model in sync with each other and working with a browser's
autocomplete, form libraries and the model.

`createElemPropsHook(  model: ComboboxModel,   elemProps: Pick<React.InputHTMLAttributes,      'disabled'      | 'value'      | 'onChange'      | 'name'>,   ref: React.Ref) => {  ref: (instance:  T  | null) => void;  form: '';  value: null;  onChange: (event: React.ChangeEvent<HTMLInputElement>) => null;  name: null;  disabled:  boolean  | undefined;  formInputProps: {    disabled:  boolean  | undefined;    tabIndex: unknown {
      "kind": "unknown",
      "value": "unknown",
      "text": "SyntheticNode - PrefixUnaryExpression"
    };    aria-hidden: true;    ref: (instance:  T  | null) => void;    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;    name:  string  | undefined;  };}`### useComboboxInputArbitrary

An arbitrary combobox can have any value. The list of options are suggestions to aid the user in
entering values. A Typeahead or Autocomplete are examples are arbitrary value comboboxes.

`createElemPropsHook(  model: ComboboxModel,   elemProps: {},   ref: React.Ref) => {  ref: (instance:  T  | null) => void;  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;}`