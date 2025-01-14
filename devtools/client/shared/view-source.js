/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Tries to open a Stylesheet file in the Style Editor. If the file is not
 * found, it is opened in source view instead.
 * Returns a promise resolving to a boolean indicating whether or not
 * the source was able to be displayed in the StyleEditor, as the built-in
 * Firefox View Source is the fallback.
 *
 * @param {Toolbox} toolbox
 * @param {string|Object} stylesheetFrontOrGeneratedURL
 * @param {number} generatedLine
 * @param {number} generatedColumn
 *
 * @return {Promise<boolean>}
 */
exports.viewSourceInStyleEditor = async function(
  toolbox,
  stylesheetFrontOrGeneratedURL,
  generatedLine,
  generatedColumn
) {
  const originalPanelId = toolbox.currentToolId;

  try {
    const panel = await toolbox.selectTool("styleeditor", "view-source", {
      // This will be only used in case the styleeditor wasn't loaded yet, to make the
      // initialization faster in case we already have a stylesheet resource. We still
      // need the rest of this function to handle subsequent calls and sourcemapped stylesheets.
      stylesheetToSelect: {
        stylesheet: stylesheetFrontOrGeneratedURL,
        line: generatedLine,
        column: generatedColumn,
      },
    });

    let stylesheetFront;
    if (typeof stylesheetFrontOrGeneratedURL === "string") {
      stylesheetFront = panel.getStylesheetFrontForGeneratedURL(
        stylesheetFrontOrGeneratedURL
      );
    } else {
      stylesheetFront = stylesheetFrontOrGeneratedURL;
    }

    const originalLocation = stylesheetFront
      ? await getOriginalLocation(
          toolbox,
          stylesheetFront.resourceId,
          generatedLine,
          generatedColumn
        )
      : null;

    if (originalLocation) {
      await panel.selectOriginalSheet(
        originalLocation.sourceId,
        originalLocation.line,
        originalLocation.column
      );
      return true;
    }

    if (stylesheetFront) {
      await panel.selectStyleSheet(
        stylesheetFront,
        generatedLine,
        generatedColumn
      );
      return true;
    }
  } catch (e) {
    console.error("Failed to view source in style editor", e);
  }

  // If we weren't able to select the stylesheet in the style editor, display it in a
  // view-source tab
  exports.viewSource(
    toolbox,
    typeof stylesheetFrontOrGeneratedURL === "string"
      ? stylesheetFrontOrGeneratedURL
      : stylesheetFrontOrGeneratedURL.href ||
          stylesheetFrontOrGeneratedURL.nodeHref,
    generatedLine
  );

  // As we might have moved to the styleeditor, switch back to the original panel
  await toolbox.selectTool(originalPanelId);

  return false;
};

/**
 * Tries to open a JavaScript file in the Debugger. If the file is not found,
 * it is opened in source view instead. Either the source URL or source actor ID
 * can be specified. If both are specified, the source actor ID is used.
 *
 * Returns a promise resolving to a boolean indicating whether or not
 * the source was able to be displayed in the Debugger, as the built-in Firefox
 * View Source is the fallback.
 *
 * @param {Toolbox} toolbox
 * @param {string} sourceURL
 * @param {number} sourceLine
 * @param {number} sourceColumn
 * @param {string} sourceID
 * @param {(string|object)} [reason=unknown]
 *
 * @return {Promise<boolean>}
 */
exports.viewSourceInDebugger = async function(
  toolbox,
  generatedURL,
  generatedLine,
  generatedColumn,
  sourceActorId,
  reason = "unknown"
) {
  const location = await getViewSourceInDebuggerLocation(
    toolbox,
    generatedURL,
    generatedLine,
    generatedColumn,
    sourceActorId
  );

  if (location) {
    const { id, line, column } = location;

    const dbg = await toolbox.selectTool("jsdebugger", reason);
    try {
      await dbg.selectSource(id, sourceActorId, line, column);
      return true;
    } catch (err) {
      console.error("Failed to view source in debugger", err);
    }
  }

  exports.viewSource(toolbox, generatedURL, generatedLine);
  return false;
};

async function getViewSourceInDebuggerLocation(
  toolbox,
  generatedURL,
  generatedLine,
  generatedColumn,
  sourceActorId
) {
  const dbg = await toolbox.loadTool("jsdebugger");

  const generatedSource = sourceActorId
    ? dbg.getSourceByActorId(sourceActorId)
    : dbg.getSourceByURL(generatedURL);
  if (
    !generatedSource ||
    // Note: We're not entirely sure when this can happen, so we may want
    // to revisit that at some point.
    dbg.getSourceActorsForSource(generatedSource.id).length === 0
  ) {
    return null;
  }

  const generatedLocation = {
    id: generatedSource.id,
    line: generatedLine,
    column: generatedColumn,
  };

  const originalLocation = await getOriginalLocation(
    toolbox,
    generatedLocation.id,
    generatedLocation.line,
    generatedLocation.column
  );

  if (!originalLocation) {
    return generatedLocation;
  }

  const originalSource = dbg.getLocationSource(originalLocation);

  if (!originalSource) {
    return generatedLocation;
  }

  return {
    id: originalSource.id,
    line: originalLocation.line,
    column: originalLocation.column,
  };
}

async function getOriginalLocation(
  toolbox,
  generatedID,
  generatedLine,
  generatedColumn
) {
  // If there is no line number, then there's no chance that we'll get back
  // a useful original location.
  if (typeof generatedLine !== "number") {
    return null;
  }

  let originalLocation = null;
  try {
    originalLocation = await toolbox.sourceMapLoader.getOriginalLocation({
      sourceId: generatedID,
      line: generatedLine,
      column: generatedColumn,
    });
    if (originalLocation && originalLocation.sourceId === generatedID) {
      originalLocation = null;
    }
  } catch (err) {
    console.error(
      "Failed to resolve sourcemapped location for the given source location",
      { generatedID, generatedLine, generatedColumn },
      err
    );
  }
  return originalLocation;
}

/**
 * Open a link in Firefox's View Source.
 *
 * @param {Toolbox} toolbox
 * @param {string} sourceURL
 * @param {number} sourceLine
 *
 * @return {Promise}
 */
exports.viewSource = async function(toolbox, sourceURL, sourceLine) {
  const utils = toolbox.gViewSourceUtils;
  utils.viewSource({
    URL: sourceURL,
    lineNumber: sourceLine || -1,
  });
};
