---
source: https://canvas.workday.com/guidelines/content/ui-text/segmented-controls
title: Segmented Controls | Workday Canvas Design System
date: 2025-08-09T14:30:16.676Z
---
# Segmented Controls

A segmented control displays different views of the same content, such as a week-long or month-long view of events. To learn more, see [Segmented Control](/components/buttons/segmented-control).

**Use Nouns to Label Segmented Controls**

Use 1 or 2 words, most likely nouns, to describe the view that users will see when they click a segmented control. 

**Why?** Although segmented controls are a button component, they don't follow our usual [button language guidelines](/guidelines/content/ui-text/buttons-and-calls-to-action/) of using a verb to describe the action the button performs. That's because it's more important to describe the different views displayed by the segmented control than it is to describe the action of switching between views. 

###### Do

- Calendar/Date Range
- Day/Week/Month
- Map/Satellite
- Table/List/Detail/Diagram

###### Don’t

- View Calendar/View Date Range
- Map View/Satellite View

**Note:** The slashes (/) are used here to indicate multiple labels on the same segmented control. We don’t use slashes in the UI.

**Instead of Long Labels, Consider Icons Paired with Tooltips**

Text in a segmented control should not truncate or wrap. If you think a label will exceed the specified maximum width or character count of the segmented control, consider using an icon paired with a tooltip instead. 

When writing tooltips to pair with segmented controls, refer to [Tooltips and Toasts](/guidelines/content/ui-text/tooltips-and-toasts).