
function updateReferences(base) {
    // update references to properties

    $.each(base.querySelectorAll("pref, sref, rref"), function(i, item) {
        var parentNode = item.parentNode;
        var content = item.textContent || item.innerText;
        var sp = document.createElement("a");
        sp.className = (item.localName === "pref" ? "property-reference" : (item.localName === "sref" ? "state-reference" : "role-reference"));
        var ref = item.getAttribute("title");
        if (!ref) {
            ref = content;
        }
        sp.href = "#" + ref;
        sp.setAttribute("title", content);
        sp.innerHTML = content;
        parentNode.replaceChild(sp, item);
    });


    // now attributes
    $.each(base.querySelectorAll("aref"), function(i, item) {
        var parentNode = item.parentNode;
        var content = item.innerHTML;
        var sp = document.createElement("a");
        sp.className = "aref";
        sp.href = "#" + content;
        sp.setAttribute("title", content);
        sp.innerHTML = content;
        parentNode.replaceChild(sp, item);
    });

    // local datatype references
    $.each(base.querySelectorAll("ldtref"), function(i, item) {
        var parentNode = item.parentNode;
        var content = item.innerHTML;
        var ref = item.getAttribute("title");
        if (!ref) {
            ref = item.textContent || item.innerText;
        }
        if (ref) {
            ref = ref.replace(/\n/g, "_");
            ref = ref.replace(/\s+/g, "_");
        }
        var sp = document.createElement("a");
        sp.className = "datatype";
        sp.title = ref;
        sp.innerHTML = content;
        parentNode.replaceChild(sp, item);
    });
    // external datatype references
    $.each(base.querySelectorAll("dtref") , function(i, item) {
        var parentNode = item.parentNode;
        var content = item.innerHTML;
        var ref = item.getAttribute("title");
        if (!ref) {
            ref = item.textContent;
        }
        if (ref) {
            ref = ref.replace(/\n/g, "_");
            ref = ref.replace(/\s+/g, "_");
        }
        var sp = document.createElement("a");
        sp.className = "externalDFN";
        sp.title = ref;
        sp.innerHTML = content;
        parentNode.replaceChild(sp, item);
    });
}

// included files are brought in after proProc.  Create a DOM tree
// of content then call the updateReferences method above on it.  Return
// the transformed content
function fixIncludes(utils, content) {
    var base = document.createElement("div");
    base.innerHTML = content;
    updateReferences(base);
    return (base.innerHTML);
}

var preProc = {
  apply:  function(c) {
            var propList = {};
            var globalSP = [];

            var skipIndex = 0;
            var myURL = document.URL;
            if (myURL.match(/\?fast/)) {
                skipIndex = 1;
            }


            // process the document before anything else is done
            // first get the properties
            $.each(document.querySelectorAll("pdef, sdef"), function(i, item) {
                var type = (item.localName === "pdef" ? "property" : "state");
                var parentNode = item.parentNode;
                var content = item.innerHTML;
                var sp = document.createElement("span");
                var title = item.getAttribute("title");
                if (!title) {
                    title = content;
                }
                sp.className = type + "-name";
                sp.title = title;
                sp.innerHTML = "<code>" + content + "</code> <span class=\"type-indicator\">(" + type + ")</span>";
                sp.setAttribute("aria-describedby", "desc-" + title);
                var dRef = item.nextElementSibling;
                var desc = dRef.firstElementChild.innerHTML;
                dRef.id = "desc-" + title;
                dRef.setAttribute("role", "definition");
                var heading = document.createElement("h3");
                heading.appendChild(sp);
                parentNode.replaceChild(heading, item);
                // add this item to the index
                propList[title] = { is: type, title: title, name: content, desc: desc, roles: [] };
                var abstract = parentNode.querySelector("." + type + "-applicability");
                if ((abstract.textContent || abstract.innerText) === "All elements of the base markup") {
                    globalSP.push({ is: type, title: title, name: content, desc: desc });
                }

            });
            
            if (!skipIndex) {
                // we have all the properties and states - spit out the
                // index
                var propIndex = "";
                var sortedList = [];
                $.each(propList, function(i) {
                    sortedList.push(i);
                });
                sortedList = sortedList.sort();

                for (var i = 0; i < sortedList.length; i++) {
                    var item = propList[sortedList[i]];
                    propIndex += "<dt><a href=\"#" + item.title + "\" class=\"" + item.is + "-reference\">" + item.name + "</a></dt>\n";
                    propIndex += "<dd>" + item.desc + "</dd>\n";
                }
                var node = document.getElementById("index_state_prop");
                var parentNode = node.parentNode;
                var l = document.createElement("dl");
                l.id = "index_state_prop";
                l.className = "compact";
                l.innerHTML = propIndex;
                parentNode.replaceChild(l, node);

                var globalSPIndex = "";
                sortedList = globalSP.sort(function(a,b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0 });
                for (var i = 0; i < sortedList.length; i++) {
                    var item = sortedList[i];
                    globalSPIndex += "<li>";
                    if (item.is === "state") {
                        globalSPIndex += "<sref title=\"" + item.name + "\">" + item.name + " (state)</sref>";
                    } else {
                        globalSPIndex += "<pref>" + item.name + "</pref>";
                    }
                    globalSPIndex += "</li>\n";
                }
                parentNode = document.querySelector("#global_states");
                if (parentNode) {
                    node = parentNode.querySelector(".placeholder");
                    if (node) {
                        var l = document.createElement("ul");
                        l.innerHTML = globalSPIndex;
                        parentNode.replaceChild(l, node);
                    }
                }
                // there is only one role that uses the global properties
                parentNode = document.querySelector("#roletype td.role-properties span.placeholder");
                if (parentNode) {
                    node = parentNode.parentNode;
                    if ((parentNode.textContent || parentNode.innerText) === "Placeholder for global states and properties") {
                        var l = document.createElement("ul");
                        l.innerHTML = globalSPIndex;
                        node.replaceChild(l, parentNode);
                    }
                }
            }

            // what about roles?
            //
            // we need to do a few things here:
            //   1. expand the rdef elements.
            //   2. accumulate the roles into a table for the indices
            //   3. grab the parent role reference so we can build up the tree
            //   4. grab any local states and properties so we can hand those down to the children
            //

            var roleInfo = {};
            var subRoles = [];
            var roleIndex = "";

            $.each(document.querySelectorAll("rdef"), function(i,item) {
                var parentNode = item.parentNode;
                var content = item.innerHTML;
                var sp = document.createElement("h3");
                var title = item.getAttribute("title");
                if (!title) {
                    title = content;
                }
                sp.className = "role-name";
                sp.title = title;
                // is this a role or an abstract role
                var type = "role";
                var abstract = parentNode.querySelectorAll(".role-abstract");
                if ($(abstract).text() === "True") {
                    type = "abstract role";
                }
                sp.innerHTML = "<code>" + content + "</code> <span class=\"type-indicator\">(" + type + ")</span>";
                // sp.id = title;
                sp.setAttribute("aria-describedby", "desc-" + title);
                var dRef = item.nextElementSibling;
                var desc = dRef.firstElementChild.innerHTML;
                dRef.id = "desc-" + title;
                dRef.setAttribute("role", "definition");
                parentNode.replaceChild(sp, item);
                roleIndex += "<dt><a href=\"#" + title + "\" class=\"role-reference\">" + content + "</a></dt>\n";
                roleIndex += "<dd>" + desc + "</dd>\n";
                // grab info about this role
                // do we have a parent class?  if so, put us in that parents list
                var node = parentNode.querySelectorAll(".role-parent rref");
                // s will hold the name of the parent role if any
                var s = null;
                var parentRoles = [];
                if (node) {
                    $.each(node, function(foo, roleref) {
                        s = roleref.textContent || roleref.innerText;

                        if (!subRoles[s]) {
                            subRoles.push(s);
                            subRoles[s] = [];
                        }
                        subRoles[s].push(title);
                        parentRoles.push(s);
                    });
                }
                // are there supported states / properties in this role?  
                var attrs = [];
                node = parentNode.querySelector(".role-properties");
                if (node && ((node.textContent && node.textContent.length !== 1) || (node.innerText && node.innerText.length !== 1))) {
                    // looks like we do
                    $.each(node.querySelectorAll("pref,sref"), function(i, item) {
                        var name = item.getAttribute("title");
                        if (!name) {
                            name = item.textContent || item.innerText;
                        }
                        var type = (item.localName === "pref" ? "property" : "state");
                        attrs.push( { is: type, name: name } );
                        // remember that the state or property is
                        // referenced by this role
                        propList[name].roles.push(title);
                    });
                }
                roleInfo[title] = { "name": title, "parentRoles": parentRoles, "localprops": attrs };
            });

            var getStates = function(role) {
                var ref = roleInfo[role];
                if (!ref) {
                    msg.pub("error", "No role definition for " + role);
                } else if (ref.allprops) {
                    return ref.allprops;
                } else {
                    var myList = [];
                    $.merge(myList, ref.localprops);
                    $.each(ref.parentRoles, function(i, item) {
                        var pList = getStates(item);
                        $.merge(myList, pList);
                    });
                    ref.allprops = myList;
                    return myList;
                }
            };
                
            if (!skipIndex) {
                // build up the complete inherited SP lists for each role
                $.each(roleInfo, function(i, item) {
                    var output = "";
                    var placeholder = document.querySelector("#" + item.name + " .role-inherited");
                    if (placeholder) {
                        var myList = [];
                        $.each(item.parentRoles, function(j, role) {
                            $.merge(myList, getStates(role));
                        });
                        var sortedList = [];
                        sortedList = myList.sort(function(a,b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0 });
                        var prev;
                        for (var j = 0; j < sortedList.length; j++) {
                            var role = sortedList[j];
                            if (prev != role.name) {
                                output += "<li>";
                                if (role.is === "state") {
                                    output += "<sref title=\"" + role.name + "\">" + role.name + " (state)</sref>";
                                } else {
                                    output += "<pref>" + role.name + "</pref>";
                                }
                                output += "</li>\n";
                                prev = role.name;
                            }
                        }
                        if (output != "") {
                            output = "<ul>\n" + output + "</ul>\n";
                            placeholder.innerHTML = output;
                        }
                    };
                });
                
                // Update state and property role references
                var getAllSubRoles = function(role) {
                    var ref = subRoles[role];
                    if (ref && ref.length) {
                        var myList = [];
                        $.each(ref, function(j, item) {
                            if (!myList.item) {
                                myList[item] = 1;
                                myList.push(item);
                                var childList = getAllSubRoles(item);
                                $.merge(myList, childList);
                            }
                        });
                        return myList;
                    } else {
                        return [];
                    }
                };
                    
                $.each(propList, function(i, item) {
                    var output = "";
                    var section = document.querySelector("#" + item.name);
                    var placeholder = section.querySelector(".state-applicability, .property-applicability");
                    if (placeholder && ((placeholder.textContent || placeholder.innerText) === "Placeholder") && item.roles.length) {
                        // update the used in roles list
                        var sortedList = [];
                        sortedList = item.roles.sort();
                        for (var j = 0; j < sortedList.length; j++) {
                            output += "<li><rref>" + sortedList[j] + "</rref></li>\n";
                        }
                        if (output != "") {
                            output = "<ul>\n" + output + "</ul>\n";
                        }
                        placeholder.innerHTML = output;
                        // also update any inherited roles
                        var myList = [];
                        $.each(item.roles, function(j, role) {
                            var children = getAllSubRoles(role);
                            $.merge(myList, children);
                        });
                        placeholder = section.querySelector(".state-descendants, .property-descendants");
                        if (placeholder && myList.length) {
                            sortedList = myList.sort();
                            output = "";
                            var last = "";
                            for (var j = 0; j < sortedList.length; j++) {
                                var item = sortedList[j];
                                if (last != item) {
                                    output += "<li><rref>" + item + "</rref></li>\n";
                                    last = item;
                                }
                            }
                            if (output != "") {
                                output = "<ul>\n" + output + "</ul>\n";
                            }
                            placeholder.innerHTML = output;
                        }
                    };
                });
                
                // spit out the index
                var node = document.getElementById("index_role");
                var parentNode = node.parentNode;
                var list = document.createElement("dl");
                list.id = "index_role";
                list.className = "compact";
                list.innerHTML = roleIndex;
                parentNode.replaceChild(list, node);

                // assuming we found some parent roles, update those parents with their children
                for (var i=0; i < subRoles.length; i++) {
                    var item = subRoles[subRoles[i]];
                    var sortedList = item.sort(function(a,b) { return a < b ? -1 : a > b ? 1 : 0 });
                    var output = "<ul>\n";
                    for (var j=0; j < sortedList.length; j++) {
                        output += "<li><rref>" + sortedList[j] + "</rref></li>\n";
                    }
                    output += "</ul>\n";
                    // put it somewhere
                    var subRolesContainer = document.querySelector("div#" + subRoles[i]);
                    if (subRolesContainer) {
                        var subRolesListContainer = subRolesContainer.querySelector(".role-children");
                        if (subRolesListContainer) {
                            subRolesListContainer.innerHTML = output;
                        }
                    }
                }

            }

            updateReferences(document);

            // prune out unused rows throughout the document
            
            $.each(document.querySelectorAll(".role-abstract, .role-parent, .role-base, .role-related, .role-scope, .role-mustcontain, .role-required-properties, .role-properties, .role-namefrom, .role-namerequired, .role-namerequired-inherited, .role-childpresentational, .role-presentational-inherited, .state-related, .property-related,.role-inherited, .role-children, .property-descendants, .state-descendants"), function(i, item) {
                var content = $(item).text();
                if (content.length === 1) {
                    // there is no item - remove the row
                    item.parentNode.remove();
                } else if (content === "Placeholder" 
                           && !skipIndex 
                           && (item.className === "role-inherited" 
                               || item.className === "role-children"
                               || item.className === "property-descendants"
                               || item.className === "state-descendants" )) {
                    item.parentNode.remove();
                }
            });
            // add a fancy CSS handler to the highlighting engine
            PR.registerLangHandler(PR.createSimpleLexer([["pln",/^[\t\n\f\r ]+/,null," \t\r\n\u000c"]],[["str",/^"(?:[^\n\f\r"\\]|\\(?:\r\n?|\n|\f)|\\[\S\s])*"/,null],["str",/^'(?:[^\n\f\r'\\]|\\(?:\r\n?|\n|\f)|\\[\S\s])*'/,null],["lang-css-str",/^url\(([^"')]+)\)/i],["kwd",/^(?:url|rgb|!important|@import|@page|@media|@charset|inherit)(?=[^\w-]|$)/i,null],["lang-css-kw",/^(-?(?:[_a-z]|\\[\da-f]+ ?)(?:[\w-]|\\\\[\da-f]+ ?)*)\s*:/i],["com",/^\/\*[^*]*\*+(?:[^*/][^*]*\*+)*\//],
            ["com",/^(?:<\!--|--\>)/],["lit",/^(?:\d+|\d*\.\d+)(?:%|[a-z]+)?/i],["lit",/^#[\da-f]{3,6}\b/i],["pln",/^-?(?:[_a-z]|\\[\da-f]+ ?)(?:[\w-]|\\\\[\da-f]+ ?)*/i],["pun",/^[^\s\w"']+/]]),["css"]);PR.registerLangHandler(PR.createSimpleLexer([],[["kwd",/^-?(?:[_a-z]|\\[\da-f]+ ?)(?:[\w-]|\\\\[\da-f]+ ?)*/i]]),["css-kw"]);PR.registerLangHandler(PR.createSimpleLexer([],[["str",/^[^"')]+/]]),["css-str"]);
        }
};

// Keep preProc def last since the syntax highlighter regex throws off syntax highlighting in some native editors.

