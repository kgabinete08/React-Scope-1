// added code for version 16 or lower
var reactInstances = window.__REACT_DEVTOOLS_GLOBAL_HOOK__._renderers;
var rid = Object.keys(reactInstances)[0];
var reactInstance = reactInstances[rid];
var devTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

var fiberDOM;
var currState;
var initialState;
var reduxStore15;

var runFifteen = false;

// get initial state and only run once
function getInitialStateOnce() {
  // console.log("getInitialStateOnce is running")
  let run = false;
  return function getInitialState() {
    if (!run) {
      // grab initial state
      let initStateSet = devTools._fiberRoots[rid];
      initStateSet.forEach((item) => {
        initialState = item;
      });
      // parse state
      initialState = checkReactDOM(initialState.current.stateNode);
      run = true;
    }
  };
}

// convert data to JSON for storage
function stringifyData(obj) {
  let box = [];
  let data = JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (box.indexOf(value) !== -1) {
          return;
        }
        box.push(value);
      }
      return value;
    }));
  box = null;
  return data;
}

// Monkey patch to listen for state changes
// has to be in IFFY?
(function connectReactDevTool() {
  // console.log('entering connect ReactDevTool')
  // for react16 or 16+
  if (reactInstance.version) {
    devTools.onCommitFiberRoot = (function (original) {
      return function (...args) {
        getFiberDOM16(args[1]);
        return original(...args);
      };
    }(devTools.onCommitFiberRoot));
  } else if (reactInstance.Mount) {
    // lower than React 16
    reactInstance.Reconciler.receiveComponent = (function (original) {
      return function (...args) {
        if (!runFifteen) {
          runFifteen = true;
          setTimeout(() => {
            getFiberDOM15(); // here you are getting the data from the DOM
            runFifteen = false;
          }, 10);
        }
        return original(...args);
      };
    }(reactInstance.Reconciler.receiveComponent));
  }
}());

// set initial state
var setInitialStateOnce = getInitialStateOnce();
(function setInitialState() {
  if (reactInstance && reactInstance.version) {
    // get initial state for 16 or higher
    // console.log("setInitial State is running ")
    setInitialStateOnce();
    setTimeout(() => {
      // saveCache.addToHead(initialState); //move this step to devtools.js instead
      // console.log('initial state: ', initialState)
      transmitData(initialState);
    }, 100);
  } else if (reactInstance && reactInstance.Mount) {
    // get intiial state for 15
    // console.log('getting intial state for 15')
    getFiberDOM15();
  } else {
    // console.log("React Dev Tools is not found")
  }
}());

// async version -- should we check for older browsers?!?!?! or use promises?!
async function getFiberDOM16(instance) {
  // console.log("getFiberDOM16 is running")
  try {
    fiberDOM = await instance;
    currState = await checkReactDOM(fiberDOM);
    // console.log(currState)
    // saveCache.addToHead(currState); move this step to devtools.js instead 
    transmitData(currState);
  } catch (e) {
    console.log(e);
  }
}

async function getFiberDOM15() {
  // console.log("getFiberDOM15 is running")
  try {
    currState = await parseData();
    // don't send if state is null
    transmitData(currState);
  } catch (e) {
    console.log(e);
  }
}

// parse data from React 15
async function parseData(components = {}) {
  let root = reactInstance.Mount._instancesByReactRootID[1]._renderedComponent;
  traverseFifteen(root, components);
  // console.log(components)
  let data = { currentState: components };
  return data;
}

// traverse React 15
function traverseFifteen(node, cache) {
  let targetNode = node._currentElement;
  if (!targetNode) {
    return;
  }
  let component = {
    name: '',
    state: null,
    props: null,
    children: {},
    store: null,
  };

  if (targetNode.type) {
    if (targetNode.type.name) {
      component.name = targetNode.type.name;
    } else if (targetNode.type.displayName) {
      component.name = targetNode.type.displayName;
    } else {
      component.name = targetNode.type;
    }
  }

  // redux
  if (targetNode.props) {
    if (targetNode.type.name === 'Provider') {
      component.store = targetNode.props.store.getState();
    }
  }

  // State
  if (node._instance && node._instance.state) {
    component.state = node._instance.state;
    if (component.state === {}) {
      component.state = null;
    }
  }

  // props
  if (targetNode && targetNode.props) {
    let props = [];
    if (typeof targetNode.props === 'object') {
      let keys = Object.keys(targetNode.props);
      keys.forEach((key) => {
        props.push(targetNode.props);
      });
      component.props = props;
    } else {
      component.props = targetNode.props;
    }
  }

  // store the objects to cache

  if (node._debugID) {
    cache[node._debugID] = component;
  } if (node._domID && !cache[node._debugID]) {
    cache[node._domID] = component;
  } else if (!cache[node._debugID] && !cache[node._domID]) {
    let mountOrder = node._mountOrder / 10;
    cache[mountOrder] = component;
  }

  // entering the children components recursively
  let children = node._renderedChildren;
  component.children = {};
  if (children) {
    let keys = Object.keys(children);
    keys.forEach((key) => {
      traverseFifteen(children[key], component.children);
    });
  } else if (node._renderedComponent) {
    traverseFifteen(node._renderedComponent, component.children);
  }
}

// traverse React 16 fiber DOM
function traverseComp(node, cache) {
  // LinkedList Style
  let component = {
    name: '',
    state: null,
    props: null,
    children: {},
  };

  // consider using switch/case
  if (node.type) {
    if (node.type.name) {
      component.name = node.type.name;
    } else {
      component.name = node.type || 'Default';
    }
  }

  if (node.memoizedState) {
    component.state = node.memoizedState;
  }

  // redux store
  if (node.type) {
    if (node.type.name === 'Provider') {
      reduxStore15 = node.stateNode.store.getState();
    }
  }

  if (node.memoizedProps) {
    let props = [];
    if (typeof node.memoizedProps === 'object') {
      let keys = Object.keys(node.memoizedProps);
      keys.forEach((key) => {
        props.push(node.memoizedProps[key]);
      });
      // need to parse the props if it is a function or an array or an object
      component.props = props[0] || props;
    } else {
      component.props = node.memoizedProps;
    }
  }

  if (node._debugID) {
    cache[node._debugID] = component;
  } else if (!node._debugID) {
    cache['Default ID'] = component;
  }

  component.children = {};
  if (node.child !== null) {
    traverseComp(node.child, component.children);
  }
  if (node.sibling !== null) {
    traverseComp(node.sibling, cache);
  }
}

// check if reactDOM is even valid and this is for React 16 or above
function checkReactDOM(reactDOM) {
  // console.log("checkReactDOM is running")
  let data = { currentState: null };
  let cache = {};
  if (reactDOM) {
    // console.log(reactDOM.current);
    traverseComp(reactDOM.current, cache); // maybe there is no need to use stateNode.current
  } else {
    return;
  }
  data.currentState = cache;
  data.currentState[1].store = reduxStore15;
  // console.log('Store with Hierarchy: ', data);
  return data;
}

function transmitData(state) {
  console.log('cache', state);
  // create a custom event to dispatch for actions for requesting data from background
  const customEvent = new CustomEvent('React-Scope-Test', { detail: { data: stringifyData(state) } });
  window.dispatchEvent(customEvent);
}
