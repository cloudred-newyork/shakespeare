var shakes = (function ($) {
  var _self = {},
    rawData = {},
    actorsData = {},
    years = [" "],
    productions = [],
    productionNames = {},
    productionNamesByID = {},
    actors = [],
    actorNodes = [],
    actorsAdded = [],
    actorPositions = {},
    productionNodes = [],
    productionPositions = {},
    yearPos = {},
    dehiliteTimer,
    paper,
    vizCenter,
    previousActorCoordinates = [],
    previousProdCoordinates = [],
    vizWidth,
    vizHeight,
    viewWidth = jQuery('body').innerWidth(),
    viewHeight = jQuery(window).height(),
    yearOrbit,
    yearLabels = [],
    yearBoxes = [],
    defaults = {
      actorColor: "#ff0072",
      screenHeightToVizRatio: 0.5,
      screenWidthToVizRatio: 0.7,
      yearGroupOffset: 90,
      minActorRadius: 4,
      maxActorRadius: 30,
      minProductionRadius: 10,
      maxProductionRadius: 30,
      fadedAlpha: 0.2,
      yearLineOuterStrokeWidth: 2
    },
    actorSet,
    yearSet,
    lineSet,
    productionsSet,
    tempLines,
    itemsFaded = false,
    fadeOutTimer = null,
    fadeInTimer = null,
    lastHighlitedItem,
    itemSelected = null,
    itemSelectedID = null,
    itemsSelected = [],
    otherActorsInSameRole = {},
    sourceActorID = null,
    UIMODE = "actor",
    animating = false,
    backgroundRect = null,
    resizeTimer = null;


  function processData() {
    productionNames = defaults.productionNames;
    productionNamesByID = defaults.productionNamesByID;
    $.each(rawData, function(index){
      var yearData = this;
      years.push(yearData.year);
      $.each(yearData.productions, function(prod_index) {
        this.year = yearData.year;
        this.prodID = productionNames[this.producion];
        productions.push(this);
      });
    });

    $.each(productions, function(){
      var prod = this;
       $.each(prod.cast, function(){ 
         if (actorsAdded.indexOf(this.actor_id) == -1) { // && actorsData[this.actor_id].years.length > 1
           actorsData[this.actor_id].id = this.actor_id;
           actors.push(actorsData[this.actor_id]);
           actorsAdded.push(this.actor_id);
         }
       });
    });

    initUI();
  }
  var posForyear = {};

  function initUI() {
    $("#basePop").css({"visibility":"visible", "display":"none"});
    $(".yearCount").css({"visibility":"visible", "display":"none"});
    $("#basePop").addClass(UIMODE);

    initViewToggle();
    initInfoToggles();
    initYears();
    //initResizeEvents();
    initRoleEvents();
    if (UIMODE == "production") {
      iniProductionsUI();
    } else {
      iniActorUI();
    }
    $('header').on('click', resetSelection);

  }
  function initResizeEvents(){
    $(window).on('resize', function (e) { 
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }  
      resizeTimer = setTimeout(function(){
        resetUI();
        initYears();
        setUIMode(UIMODE);
      }, 500);

    });
  }
  function initRoleEvents() {
    $('#vizContent').on('click', '.infoContainer .role',function(){
      var role = $(this),
          year = $(this).parents('.container').attr('rel');
      sourceActorID = role.parents('.infoContainer').attr('rel');
      role.parents('.infoContainer').remove();
      higlightItemsByRole(role.attr('rel'), role.text(),year, sourceActorID);
    });
  }
  function initInfoToggles() {
    $('#infoBox .toggle').on('click', function(){
      var clicked = $(this);
      resetSelection();
      if (clicked.parent().hasClass('closed')) {
        clicked.parent().removeClass('closed').addClass('open');
        $('#about').show(400, 'linear', function(){
          if (UIMODE == 'actor') {
            $('#notableCharacters').show(400, 'linear');
          }
        });
      } else {
        clicked.parent().removeClass('open').addClass('closed');
        $('#notableCharacters').hide(400, 'linear', function(){
          $('#about').hide(400, 'linear');
        });
      }
    });
    $('#productionLegend .toggle').on('click', function(){
      var clicked = $(this);
      if (clicked.parent().hasClass('closed')) {
        clicked.parent().removeClass('closed').addClass('open');
      } else {
        clicked.parent().removeClass('open').addClass('closed');

      }
    });
    $('#notableCharacters li').on('click', function(){
      var clicked = $(this);
      $('#infoBox').removeClass('open').addClass('closed');
      higlightItemsByRole(clicked.attr('rel'),clicked.text());
      $('#notableCharacters').hide(400, 'linear', function(){
        $('#about').hide(400, 'linear');
      });
    })
  }
  function initViewToggle() {
    $('#viewToggle span').on('click', function(){
      if (animating) return;
      var clicked = $(this);
      if (clicked.parent().hasClass('mode-' + clicked.attr('class'))) {
        return;
      }
      clicked.parent().removeClass('mode-actor mode-production').addClass('mode-'+ clicked.attr('class'));
      setUIMode(clicked.attr('class'));
    });
  }
  function setUIMode (mode) {
    resetUI();
    UIMODE = mode;

    if (UIMODE == "production") {
      iniProductionsUI();
    } else {
      iniActorUI();
    }
    $("body, #basePop").removeClass('actor production').addClass(UIMODE);
  }

  function resetUI() {
    resetSelection();

    if (actorSet) {
      actorSet.remove();
      actorSet = null;
      actorNodes = [];
    }
    if (lineSet) {
      lineSet.remove();
      lineSet = null;
    }
    if (productionsSet) {
      productionsSet.remove();
      productionsSet = null;
      productionNodes = [];
    }
    if (backgroundRect) {
      backgroundRect.remove();
      backgroundRect = null;
    }
    if (tempLines) {
      tempLines.remove();
      tempLines = null;
    }
  }

  function initYears() {

    viewWidth = jQuery('body').innerWidth();
    viewHeight = jQuery(window).height();
    vizWidth = Math.max(viewWidth, 1024);
    vizHeight = Math.max(viewHeight, 768);
    
    if (vizWidth < 1300) {
      defaults.maxProductionRadius = defaults.maxProductionRadius * (vizWidth / 1300);
    }
    var a = Math.round((vizWidth * defaults.screenWidthToVizRatio)/2),
        b = Math.round((vizHeight * defaults.screenHeightToVizRatio)/2),
        ellipse,
        orbit,
        segmentLength;
    vizCenter = {x: Math.round(vizWidth / 2), y: Math.round(vizHeight / 2) + 60};
    if (paper) {
      paper.setSize(vizWidth,vizHeight)
    } else {
      paper = new Raphael(document.getElementById('vizContent'), vizWidth,vizHeight);
      paper.customAttributes.along = function(v) {
        var point = this.path.getPointAtLength(v * this.pathLen),
          attrs = {
            cx: point.x,
            cy: point.yb
          };
        this.rotateWith && (attrs.transform = 'r'+point.alpha);
        return attrs;
      }
    }
    if (actorSet == null) {
      actorSet = paper.set();
    }
    if (lineSet == null) {
      lineSet = paper.set();
    } 
    if (yearSet) {
      yearSet.remove();
      yearSet = null;
      previousActorCoordinates = null;
      previousProdCoordinates = null;
      previousActorCoordinates = [];
      previousProdCoordinates = [];
      var id = window.setTimeout(function() {}, 0);
      while (id--) {
          window.clearTimeout(id); // will do nothing if no timeout with id is present
      }
    }
    yearSet = paper.set();
    
    ellipse = "M" + (vizCenter.x - a) + "," + vizCenter.y + " a " + a + "," + b + " 0 1,1 0,0.1";
    yearOrbit = paper.path(ellipse).attr({"opacity":0});
    segmentLength = (yearOrbit.getTotalLength() / years.length);
    

    $.each(years, function(index){
      var item = this;
      var pos = yearOrbit.getPointAtLength(segmentLength * index),
        yearPos = { x: Math.round(pos.x), y: Math.round(pos.y), radius : 25 };
        posForyear[years[index]] = yearPos;

      previousActorCoordinates.push(yearPos);
      previousProdCoordinates.push(yearPos);
      setTimeout(function(){
        addYear(index,yearPos);
      },25 * index);
    });
      
  }
  function addYear(index, yearPos) {
    if (index != 0) {
      yearBoxes[index] = paper.rect(yearPos.x - 20, yearPos.y - 14, 40, 28, 4).attr({"fill": "#eeeeee", "stroke-width": 0}).animate({"fill": "#dedede"}, 100);
    }
    yearLabels[index] = paper.text(yearPos.x,yearPos.y,years[index]).attr({'font-size':'1pt', 'font-weight':'bold'}).animate({'font-size':'12pt'}, 100);
    yearSet.push(yearBoxes[index]);
    yearSet.push(yearLabels[index]);
  }
  function iniActorUI() {
    animating = true;
    if (actorSet == null) {
      actorSet = paper.set();
    }
    if (lineSet == null) {
      lineSet = paper.set();
    }

    if (Object.keys(actorPositions).length == 0) {
      $.each(actors, function(index){
        var radius = this.productions.length == 1 ? defaults.minActorRadius : (Math.round(Math.min(2 * this.productions.length, defaults.maxActorRadius)));
        actorPositions[index] = findPositionForNode(this.years, radius + 1);
      }); 
    }
    $.each(actors, function(index){
      var actor = this;

      setTimeout(function(){
        var actorPos = actorPositions[index];
        connectToYears(actorPos, actor.years);
        var color = defaults.actorColor;
        actorNodes[index] = paper.circle(actorPos.x,actorPos.y,1).attr({'className': "actor", fill:color, stroke:'white', 'stroke-width':1}).animate({r:actorPos.radius}, 100);
        actorNodes[index].node.id = index;
        actorNodes[index].hover(rollOverItem,rollOutItem)
                         .click(itemClicked);

        actorSet.push(actorNodes[index]);
        //paper.circle(actorPos.x,actorPos.y,radius).attr({fill:color, stroke:'trasparent', 'stroke-width':1, title: actor.name + " " + actor.productions.length})
        //
        if (index == actors.length - 1) {
          if (backgroundRect == null) {
            backgroundRect = paper.rect(0,0,vizWidth,vizHeight).attr({fill:'rgba(255,255,255,0)', stroke:'none'}).toBack().click(resetSelection);
          } else {
            backgroundRect.toBack();
          }
          animating = false;
        }
      }, 2 * index / 2);

    });

  }

  function connectToYears(origin, years, temp, keepOthers) {
    var yearsToCalculate = [];
    if ( tempLines && !keepOthers ) {
      tempLines.remove();
      tempLines = null;
    }
    if ( !keepOthers ) {
      tempLines = paper.set();
    }
    $.each(years,function(i){
      if (posForyear[this]) {
        var yearPos = posForyear[this];
        
        if (temp) {
          var underLine = paper.path("M"+ origin.x +" "+ origin.y + "L"+ yearPos.x +" "+ yearPos.y)
          .attr({stroke: "rgba(255,255,255,1)", 'stroke-width': defaults.yearLineOuterStrokeWidth});
          tempLines.push(underLine);
        }
        var line = paper.path("M"+ origin.x +" "+ origin.y + "L"+ yearPos.x +" "+ yearPos.y)
          .attr({stroke: "rgba(0,0,0," + (temp ? "1" : "0.05") +")"});
        
        if (temp) {
          tempLines.push(line);
        } else {
          line.toBack();
          lineSet.push(line);
        }
      }
    });
    
  }

  function resetSelection() {
    resetItem(itemSelectedID);
    itemSelected = null;
    itemSelectedID = null;
    sourceActorID = null;
    otherActorsInSameRole = {};
    if (itemsFaded) {
      fadeInTimer = setTimeout(fadeInItems, 100);
    }
  }

  function fadeOutItems(exceptThisOne){
    yearSet.attr({opacity: defaults.fadedAlpha});
    itemsFaded = true;
    fadeOutTimer = null;
  }
  
  function fadeInItems(){
    yearSet.attr({opacity: 1});
    itemsFaded = false;
  }

  function resetItem(id) {
    if ((id == null) && itemsSelected.length == 0) {
      return;
    }
    if (id != null && itemsSelected.length > 0) {
      var actorID =  actorsAdded[id];
      if (actorID && otherActorsInSameRole[actorID]) {
        var nodePosition = actorPositions[id];
        $('#itemInfo' + id).remove();
        actorNodes[id].animate({r: Math.max(defaults.maxActorRadius / 2,  nodePosition.radius ) },100);
        lastHighlitedItem = null;
      } 
      return;
    }
    if (id != null) {
      resetItemsProccess(id);
      return;
    }
    if (itemsSelected.length > 0) {
      $.each(itemsSelected, function(){
        resetItemsProccess(this);
      });
      itemsSelected = [];
      return;
    }

  }
  function resetItemsProccess(id) {
    if (id == null) {
      return;
    }
    var nodeData = (UIMODE == "actor") ? actors[id].years : getYearsForProduction(id),
        nodeSource = (UIMODE == "actor") ? actorNodes : productionNodes,
        nodeName = (UIMODE == "actor") ? actors[id].name : productionNamesByID[id],
        nodePosition = (UIMODE == "actor") ? actorPositions[id] : productionPositions[id],
        nodeColor = (UIMODE == "actor") ? defaults.actorColor : defaults.productionColors[id];
    if (itemsFaded) {
      toggleYears(nodeData,true); 
    }
    nodeSource[id].attr({"fillfit":nodeColor}).animate({r: nodePosition.radius},100);
    lastHighlitedItem = null;
    if (tempLines) {
      tempLines.forEach(function(e){
          e.remove();
      })
    }
    hideYearCount();
    $('#itemInfo' + id).remove();
  }
  function higlightItem(id) {
    var nodeData = (UIMODE == "actor") ? actors[id].years : getYearsForProduction(id),
        nodeSource = (UIMODE == "actor") ? actorNodes : productionNodes,
        nodeName = (UIMODE == "actor") ? actors[id].name : productionNamesByID[id],
        nodePosition = (UIMODE == "actor") ? actorPositions[id] : productionPositions[id],
        pop = $('#itemInfo' + id);
 
    if (pop.length == 0) {
      pop = $('#basePop').clone().attr('id', 'itemInfo' + id).appendTo('#vizContent');
    }
    
    connectToYears(nodePosition, nodeData, true);
    toggleYears(nodeData,false); 
    nodeSource[id].toFront();
    if (UIMODE == "actor") {
      nodeSource[id].attr({opacity: 1,"fillfit": "url(actor-images/IMG_"+ actors[id].id +".jpg)"});
    } else {
      showYearCount(nodeData, nodePosition);
    }
    lastHighlitedItem = id;
    pop
      .empty()
      .html('<div class="title">'+nodeName+'</div>')
      .css({"top": nodePosition.y + nodePosition.radius + 8, "left": nodePosition.x -44 })
      .show();
  }
  function matchRoles(roleA, roleB) {
    var rolesA = roleA.split('/'),
        rolesB = roleB.split('/'),
        foundMatch = false;
    rolesB.forEach(function(role, index){
      rolesB[index] = role.trim();
    });
    rolesA.forEach(function(role){
      role.trim();
      if (rolesB.indexOf(role) > -1) {
        foundMatch = true;
      }
    });
    return foundMatch;
  }
  function higlightItemsByRole(prodID, role, exclude, sourceActor) {
    itemSelected = null;
    itemSelectedID = null;
    otherActorsInSameRole = {};
    resetItem(lastHighlitedItem);
    $.each(productions, function(prod_index) {
      if (this.prodID == prodID) {
        var prod = this;
        $.each(this.cast, function(){ 
          if (matchRoles(this.Role, role) && ((prod.year != exclude) || (prod.year == exclude && sourceActor == this.actor_id)) ) { 
            var temp = {'year': prod.year, 'role': this.Role, 'prodName': prod.producion };
            if (otherActorsInSameRole[this.actor_id]) {
              otherActorsInSameRole[this.actor_id].roles.push(temp);
            } else {
              otherActorsInSameRole[this.actor_id] = {
                roles : [temp]
              }
            }
          }
        });
      }
    });
    if (!sourceActor) {
      var allIDs = Object.keys(otherActorsInSameRole);
      sourceActor = allIDs[allIDs.length - 1];
      sourceActorID = sourceActor;
    }
    $.each(otherActorsInSameRole, function(key, val){
      if (key == sourceActor) {
        filteredHilight(key, val, sourceActor);
      } else {
        identifyOtherActorInRole(key, val);
      }
    });
  }
  function identifyOtherActorInRole(actorID, actorData, sourceActor) {
    var id = actorsAdded.indexOf(actorID),
        nodeSource = actorNodes,
        nodeName = actors[id].name,
        nodePosition = actorPositions[id],
        nodeData = [],
        yearsRendered = [],
        popUpHeight,
        popUpWidth,
        pop = $('#itemInfo' + id);
 
    if (pop.length == 0) {
      pop = $('#basePop').clone().attr('id', 'itemInfo' + id).appendTo('#vizContent');
    }

    $.each(actorData.roles, function(){
      nodeData.push(this.year);
    });
    connectToYears(nodePosition, nodeData, true, true);
    toggleYears(nodeData,false); 
    nodeSource[id]
      .toFront()
      .attr({opacity: 1,"fillfit": "url(actor-images/IMG_"+ actors[id].id +".jpg)"})
      .animate({r: Math.max(defaults.maxActorRadius / 2,  nodePosition.radius ) },100);
    //itemSelected = true;
    itemsSelected.push(id);  
  }
  function filteredHilight(actorID, actorData, sourceActor) {
    var id = actorsAdded.indexOf(actorID),
        nodeSource = actorNodes,
        nodeName = actors[id].name,
        nodePosition = actorPositions[id],
        nodeData = [],
        yearsRendered = [],
        popUpHeight,
        popUpWidth,
        pop = $('#itemInfo' + id);
 
    if (pop.length == 0) {
      pop = $('#basePop').clone().attr('id', 'itemInfo' + id).css({'z-index': 10000}).appendTo('#vizContent');
    }
 
    lastHighlitedItem = id;
    $.each(actorData.roles, function(){
      nodeData.push(this.year);
    });
    connectToYears(nodePosition, nodeData, true, true);
    toggleYears(nodeData,false); 
    nodeSource[id]
      .toFront()
      .attr({opacity: 1,"fillfit": "url(actor-images/IMG_"+ actors[id].id +".jpg)"})
      .animate({r: defaults.maxActorRadius},100);
    //itemSelected = true;
    itemsSelected.push(id);   
    contentDiv = pop.empty().html('<div class="title">'+nodeName+'</div><div class="contents cf"></div>').find('.contents');

    $.each(actorData.roles, function(index){
      var container;
      if (yearsRendered.indexOf(this.year) == -1) {
        container = $('<div class="container cf" rel="' +this.year+ '"></div>').appendTo(contentDiv);
        container.append($('<div class="year">' + this.year + '</div>'));
        yearsRendered.push(this.year)
      } else {
        container = contentDiv.find('div[rel='+ this.year +']');
      }
      container.append($('<div class="producion"><span class="prod">' + this.prodName + '</span><span class="roleNonClick" rel="'+ this.prodID +'">' + this.role + '</span></div>'));

    });
    contentDiv.append($('<div class="showAllRoles"></div>'))

    popUpHeight = pop.height();
    popUpWidth = pop.width();

    function positionPop(move) {
      var popOrigin = {x: nodePosition.x -44 , y: nodePosition.y + defaults.maxActorRadius + 8};
      var willFitDown = popOrigin.y + popUpHeight < viewHeight;
      var willFitRight = popOrigin.x + popUpWidth < viewWidth;
      var move = move;
      if (!willFitDown) {
        popOrigin.y = nodePosition.y - defaults.maxActorRadius - 8 - popUpHeight;
        pop.addClass('onTop');
      }
      if (!willFitRight) {
        pop.css({"top": 0, "left": 0});
        popUpHeight = pop.height();
        popUpWidth = pop.width();
        popOrigin.x = nodePosition.x + 44 - popUpWidth;
        pop.addClass('onLeft');
      }
      if (move == 1) {
        popOrigin.x = nodePosition.x - (popUpWidth / 2);
        popOrigin.y = nodePosition.y - (popUpHeight) - defaults.maxActorRadius - 9;
        pop.removeClass('onTop onLeft').addClass('centerBottom');

        move = 2;
      } else if (move == 2) {
        popOrigin.x = nodePosition.x + defaults.maxActorRadius + 9;
        popOrigin.y = nodePosition.y - defaults.maxActorRadius;
        pop.removeClass('onTop onLeft centerBottom').addClass('onRight');

        move = 3;
      } else if (move == 3) {
        popOrigin.x = nodePosition.x - (popUpWidth / 2);
        popOrigin.y = nodePosition.y + defaults.maxActorRadius + 9;
        pop.removeClass('onTop onLeft onRight').addClass('centerTop');

        move = 4;
      } else if (move == 4) {
        popOrigin.x = nodePosition.x - popUpWidth - defaults.maxActorRadius - 9;
        popOrigin.y = nodePosition.y - defaults.maxActorRadius;
        pop.removeClass('onTop onLeft centerTop').addClass('onLeftSide');
      }

      pop.css({"top": popOrigin.y, "left": popOrigin.x});
      if (move != 4 && checkForDivCollisions(id)) {
        if (!move) {
          move = 1;
        }
        positionPop(move);
      }
    }
    positionPop();
    pop.show();
  }

  function showYearCount(nodeData, nodePosition) {
    $('.yearCount')
      .find('span').text(nodeData.length).end()
      .css({"top": nodePosition.y - 21, "left": nodePosition.x - 21 })
      .show();
  }
  function hideYearCount() {
    $('.yearCount').hide();
  }
  function toggleYears(actorYears,faded) {
    $.each(actorYears, function(index, item){
      var yearIndex = years.indexOf(item);
      yearBoxes[yearIndex].attr({opacity: faded ? defaults.fadedAlpha : 1});
      yearLabels[yearIndex].attr({opacity: faded ? defaults.fadedAlpha : 1});
      if (!faded) {
        yearBoxes[yearIndex].toFront();
        yearLabels[yearIndex].toFront();
      }
    });
  }
  function rollOverItem(e) {
    var id = this.node.id;
    this.attr({cursor: "pointer"});
    if (fadeInTimer) {
      clearTimeout(fadeInTimer);
      fadeInTimer = null;
    }
    if (itemSelected) {
      return;
    }
    if (itemsSelected.length > 0) {
      var actorID = actorsAdded[id];
      if (otherActorsInSameRole[actorID] && actorID != sourceActorID) {
        filteredHilight(actorID, otherActorsInSameRole[actorID]);
        actorNodes[id].toFront();
      }
      return;
    }
    if (lastHighlitedItem) {
      resetItem(lastHighlitedItem);
    }
    if (!itemsFaded) {
      fadeOutTimer = setTimeout(function(){
        fadeOutItems(id);
        higlightItem(id);
      }, 100);
    } else {
      higlightItem(id);
    }
  }
  function rollOutItem(e) {
    var id = this.node.id;
    if (fadeOutTimer) {
      clearTimeout(fadeOutTimer);
      fadeOutTimer = null;
    }
    if (itemsSelected.length > 0) {
      var actorID = actorsAdded[id];
      if (!sourceActorID || (sourceActorID && sourceActorID == actorID )) {
        return;
      } else if (lastHighlitedItem == id) {
        resetItem(lastHighlitedItem);
      }          
      return;
    }
    if (itemSelected) {
      return;
    }
    if (itemsFaded) {
      fadeInTimer = setTimeout(fadeInItems, 100);
    }
    if (lastHighlitedItem) {
      resetItem(lastHighlitedItem);
    }
  }

  function itemClicked(e) {
    var id = this.node.id;

    if ((itemSelected && itemSelectedID != id) || itemsSelected.length > 0) {
      if (!itemsFaded) {
        fadeOutItems(id);
      }
      resetItem(itemSelectedID);
      itemSelected = null;
      itemSelectedID = null;
      sourceActorID = null;
      otherActorsInSameRole = {};
      higlightItem(id);
      selectItem(id);
    
    } else if (itemSelected && itemSelectedID == id) {
      resetSelection();

    } else {
      if (!itemsFaded) {
        fadeOutItems(id);
      }
      if (id != lastHighlitedItem) {
        higlightItem(id);
      }
      selectItem(id);
    }
        
  }

  function selectItem(id) {
    var nodeSource = (UIMODE == "actor") ? actorNodes : productionNodes,
        maxSize = (UIMODE == "actor") ? defaults.maxActorRadius : defaults.maxProductionRadius;
    nodeSource[id].toFront().animate({r: maxSize},100);
    itemSelectedID = id;
    itemSelected = true;
    showInfoForItem(id);
  }

  function showInfoForItem(id) {
    var nodeData = (UIMODE == "actor") ? actors[id].years : getYearsForProduction(id),
        nodeSource = (UIMODE == "actor") ? actorNodes : productionNodes,
        nodeName = (UIMODE == "actor") ? actors[id].name : productionNamesByID[id],
        originPos = (UIMODE == "actor") ? actorPositions[id] : productionPositions[id],
        offset = (UIMODE == "actor") ? defaults.maxActorRadius : defaults.maxProductionRadius,
        popOrigin = {x: originPos.x -44 , y: originPos.y + offset + 8},
        pop = $('#itemInfo' + id);
    if (pop.length == 0) {
      pop = $('#basePop').clone().attr('id', 'itemInfo' + id).appendTo('#vizContent');
    }
    if (UIMODE == "actor") {
      populateInfoForActorID(id);
    } else {
      populateInfoForProductionID(id);
    }   

  

    pop.addClass(UIMODE);
    var popUpHeight = pop.height(),
        popUpWidth = pop.width(),
        willFitDown = popOrigin.y + popUpHeight < viewHeight,
        willFitRight = popOrigin.x + popUpWidth < viewWidth,
        willFitUp = popOrigin.y - defaults.maxActorRadius - 8 - popUpHeight > 0,
        willFitLeft = popOrigin.x - defaults.maxActorRadius - popUpWidth > 0;

    if (!willFitDown) {
      popOrigin.y = originPos.y - offset - 8 - popUpHeight;
      pop.addClass('onTop');
    }
    if (!willFitRight) {
      pop.css({"top": 0, "left": 0});
      popUpHeight = pop.height();
      popUpWidth = pop.width();
      popOrigin.x = originPos.x + 44 - popUpWidth;
      pop.addClass('onLeft');
    }
    if (!willFitUp && willFitRight) {
      popOrigin.x = originPos.x + defaults.maxActorRadius + 9;
      popOrigin.y = originPos.y - (popUpHeight / 2);
      pop.removeClass('onTop onLeft').addClass('onRightCenter');
    }
    pop.css({"top": popOrigin.y, "left": popOrigin.x}).show('slow');
  }
  function iniProductionsUI() {
    animating = true;
    if (productionsSet == null) {
      productionsSet = paper.set();
    }
    if (lineSet == null) {
      lineSet = paper.set();
    }

    if (Object.keys(productionPositions).length == 0) {
      $.each(productionNames, function(key, prod){

        var years = getYearsForProduction(prod);
        var radius = Math.min((years.length == 1 ? defaults.minProductionRadius : years.length * 8), defaults.maxProductionRadius);
        productionPositions[prod] = findPositionForNode(years, radius + 1);
      }); 
    }

    var index = 0;
    $.each(productionNames, function(key, prod){
      
      var productionIndex = index;
      setTimeout(function(){
        var years = getYearsForProduction(prod),
            prodPos = productionPositions[prod],
            color = defaults.productionColors[prod];
        connectToYears(prodPos, years);
        productionNodes[prod] = paper.circle(prodPos.x,prodPos.y,1).attr({fill:color, stroke:'white', 'stroke-width':1}).animate({r:prodPos.radius}, 100);;
        productionNodes[prod].node.id = (prod);
        productionNodes[prod].hover(rollOverItem,rollOutItem)
                         .click(itemClicked);
        productionsSet.push(productionNodes[prod]);
        if ((productionIndex + 1) >= Object.keys(productionNames).length) {
          if (backgroundRect == null) {
            backgroundRect = paper.rect(0,0,vizWidth,vizHeight).attr({fill:'rgba(255,255,255,0)', stroke:'none'}).toBack().click(resetSelection);
          } else {
            backgroundRect.toBack();
          }
          animating = false;
        }
      }, 50 * productionIndex / 2);
      index++;
    });
        
  }
  function populateInfoForProductionID(id) {
    var productionName = productionNamesByID[id],
        yearsForProd = getYearsForProduction(id),
        prods = [],
        yearsRendered = [],
        willNeedToSplit = false,
        pop = $('#itemInfo' + id);
    if (pop.length == 0) {
      pop = $('#basePop').clone().attr('id', 'itemInfo' + id).appendTo('#vizContent');
    }
    
    $.each(rawData, function(index){
      var yearData = this;
      if (yearsForProd.indexOf(yearData.year) == -1) {
        return;
      }
      $.each(yearData.productions, function(prod_index) {
        if (this.prodID == id) {
          prods.push({"year": this.year, "director" : this.director});
        }
      });
    });
    
    if (prods.length > 3) {
      willNeedToSplit = true;
      pop.addClass('twoCols');
    }
    if (willNeedToSplit) {
      contentDiv = pop.empty().html('<div class="title">'+productionName+'</div><div class="contents colwrapper cf"><div class="contentsA"></div><div class="contentsB"></div></div>').find('.contentsA');
    } else {
      contentDiv = pop.empty().html('<div class="title">'+productionName+'</div><div class="contents cf"></div>').find('.contents');
    }
    $.each(prods, function(index){
      var container,
          pastHalf = false;
      if (willNeedToSplit && index >= prods.length / 2) {
        pastHalf = true;
      }
      if (pastHalf) contentDiv = pop.find('.contentsB');
      container = $('<div class="container cf" rel="' +this.year+ '"></div>').appendTo(contentDiv);
      container.append($('<div class="year">' + this.year + '</div>'));
      container.append($('<div class="producion"><span class="prod">' + this.director + '</span><span class="roleNonClick">Director</span></div>'));
    });
  }
  function populateInfoForActorID(id) {
    var actor = actors[id],
        productionsForActor = [],
        yearsRendered = [],
        willNeedToSplit = false,
        pop = $('#itemInfo' + id);
    if (pop.length == 0) {
      pop = $('#basePop').clone().attr('id', 'itemInfo' + id);
    }
    pop.attr('rel', actors[id].id).appendTo('#vizContent');
    $.each(productions, function(){
      var prod = this;
      if (actor.years.indexOf( prod.year ) != -1) {
        $.each(prod.cast, function(){ 
           if (this.actor_id == actor.id) { 
            productionsForActor.push({"year": prod.year, "prodName": prod.producion, "role" : this.Role, "prodID": prod.prodID});
            }
         });
      }
    });

    if (actor.years.length > 3 && productionsForActor.length > 3) {
      willNeedToSplit = true;
      pop.addClass('twoCols');
    }

    if (willNeedToSplit) {
      contentDiv = pop.empty().html('<div class="title">'+actor.name+'</div><div class="contents colwrapper cf"><div class="contentsA"></div><div class="contentsB"></div></div>').find('.contentsA');
    } else {
      contentDiv = pop.empty().html('<div class="title">'+actor.name+'</div><div class="contents cf"></div>').find('.contents');
    }
    $.each(productionsForActor, function(index){
      var container,
          pastHalf = false;
      if (willNeedToSplit && index >=  productionsForActor.length / 2) {
        pastHalf = true;
      }
      if (yearsRendered.indexOf(this.year) == -1) {
        if (pastHalf) contentDiv = pop.find('.contentsB');
        container = $('<div class="container cf" rel="' +this.year+ '"></div>').appendTo(contentDiv);
        container.append($('<div class="year">' + this.year + '</div>'));
        yearsRendered.push(this.year)
      } else {
        container = contentDiv.find('div[rel='+ this.year +']');
      }
      container.append($('<div class="producion"><span class="prod">' + this.prodName + '</span><span class="role" rel="'+ this.prodID +'">' + this.role + '</span></div>'));
    });

  }

  function getYearsForProduction(prodID) {
    var years = [];
    $.each(productions, function(prod_index) {
      if (this.prodID == prodID) {
        years.push(this.year);
      }
    });
    return years;
  }






  function findPositionForNode(years, size) {
    var position = findCenterWithRadius(years),
        wasMoved = false;
    position.radius = size;

    function getOffsetPos(pos) {
      var offset = (size * 2) + 2; 
      var a = 2 * Math.PI * Math.random();
      var newPos = { x: Math.round(pos.x - offset * Math.cos(a)), y: Math.round(pos.y - offset * Math.sin(a)), radius: size};

      if (0 > newPos.x || newPos.x >= vizWidth || 0 > newPos.y || newPos.y >= vizHeight || ((years.length > 1) && pointOutside(newPos))) return getOffsetPos(pos);

      return newPos;
    }
    if (years.length > 1) {
      while (pointOutside(position)) {
        var c =  moverPointCloserToCenter(position);
        //wasMoved = true;
        position = c;
      }
    }

    while (checkForCollisions(position)) {
      wasMoved = true;
      var b = getOffsetPos(position);
      position = b;
    }
    if (UIMODE == "actor") {
      previousActorCoordinates.push(position); 
    } else {
      previousProdCoordinates.push(position);
    }
    if (wasMoved) {
      position.moved = true;
    }
    return position;
    
  }


  function checkForCollisions(a) {
    var collides = false;
    var prevCoord = UIMODE == "actor" ? previousActorCoordinates : previousProdCoordinates;
    $.each(prevCoord, function(){
      if (collisionDetected(a, this)) {
        collides = true;
        return false;
      }
    })
    return collides;
  }

  function collisionDetected( elementA, elementB) {
    var x = Math.sqrt(( elementB.x - elementA.x ) * ( elementB.x - elementA.x )  + ( elementB.y - elementA.y ) * ( elementB.y - elementA.y ))
    if (x < elementA.radius + elementB.radius) {
        return true;
    }
    return false;
  }

  function checkForDivCollisions(id) {
    var collides = false;
    var itemA = $('#itemInfo' + id);
    $.each(itemsSelected, function(){
      if (id != this) {
        var itemB = $('#itemInfo' + this);
        if (divCollisionDetected(itemA, itemB)) {
          collides = true;
          return false;
        }
      }
    })
    return collides;
  }

  function divCollisionDetected(elementA, elementB) {
    var x1 = parseInt(elementA.css('left'));
    var y1 = parseInt(elementA.css('top'));
    var h1 = elementA.outerHeight(true);
    var w1 = elementA.outerWidth(true);
    var b1 = y1 + h1;
    var r1 = x1 + w1;
    var x2 = parseInt(elementB.css('left'));
    var y2 = parseInt(elementB.css('top'));
    var h2 = elementB.outerHeight(true);
    var w2 = elementB.outerWidth(true);
    var b2 = y2 + h2;
    var r2 = x2 + w2;
    if (b1 < y2 || y1 > b2 || r1 < x2 || x1 > r2) return false;
    return true;
  }
  function pointOutside(point) {

    //I have an ellipse centered at (h,k), with semi-major axis rx, semi-minor axis ry,
    //determine if a point (point.x,point.y) is within the area bounded by the ellipse
    var h = vizCenter.x,
        k = vizCenter.y,
        rx = Math.round((vizWidth * 0.6)/2),
        ry = Math.round((vizHeight * 0.45)/2);
        isOutside = (((point.x - h) * (point.x - h)) / (rx * rx) + ((point.y - k) * (point.y - k)) / (ry * ry)) > 1;

    return isOutside;
  }

  function findCenterWithRadius(yearsArray) {
    var xS = [],
        yS = [],
        center;
    var yearsToCalculate = [];

    $.each(yearsArray,function(i){
      if (posForyear[this]) {
        yearsToCalculate.push(this);
      }
    });

    if (yearsToCalculate.length == 1) {
      return extendedCoordiateForYear(yearsToCalculate[0]);
    }
    $.each(yearsToCalculate, function(i) {
      xS.push(posForyear[this].x);
      yS.push(posForyear[this].y);
    })



    center = { x: Math.round(median(xS)), y: Math.round(median(yS)) };


    return center;
  }
  function median(values) {
    values.sort( function(a,b) {return a - b;} );
    var half = Math.floor(values.length/2);
    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
  }
  function extendedCoordiateForYear(year) {
    var distance = defaults.yearGroupOffset,
        p1 = vizCenter,
        p2 = posForyear[year],
        angleRadians = Math.atan2(p2.y - p1.y, p2.x - p1.x),
        newCoordinates = { x: Math.round(p2.x + distance * Math.cos(angleRadians)), y: Math.round(p2.y + (distance * Math.sin(angleRadians))) };
    return newCoordinates;
  }

  function moverPointCloserToCenter(point) {
    var distance = 10,
        p1 = vizCenter,
        p2 = point,
        angleRadians = Math.atan2(p2.y - p1.y, p2.x - p1.x),
        newCoordinates = { x: Math.round(p2.x - distance * Math.cos(angleRadians)), y: Math.round(p2.y - (distance * Math.sin(angleRadians))), radius : point.radius};

    return newCoordinates;
  }
  _self.init = function (defaultOptions) {
    if (defaultOptions) {
      defaults = defaultOptions;
    }
    var actorsCall = $.getJSON( "data/actors.json", function(data) {
        actorsData = data;
        $.getJSON( "data/shakespeare.json", function(data) {
          rawData = data;
          processData();
          });
        });
  };
  return _self;

}(jQuery));
