"use strict";

(function()
{
    /** @const */
    var ON_LOCALHOST = 0; // !location.hostname.endsWith("copy.sh"); JvB commented out

    /** @const */
    var HOST = /* ON_LOCALHOST */ 1 ? "images/" : "//k.copy.sh/"; // JvB fixed

    /**
     * @return {Object.<string, string>}
     */
    function get_query_arguments()
    {
        var query = location.search.substr(1).split("&");
        var parameters = {};

        for(var i = 0; i < query.length; i++)
        {
            var param = query[i].split("=");
            parameters[param[0]] = decodeURIComponent(param.slice(1).join("="));
        }

        return parameters;
    }

    function set_title(text)
    {
        document.title = text + " - Virtual x86" +  (DEBUG ? " - debug" : "");
        const description = document.querySelector("meta[name=description]");
        description && (description.content = "Running " + text);
    }

    function format_timestamp(time)
    {
        if(time < 60)
        {
            return time + "s";
        }
        else if(time < 3600)
        {
            return (time / 60 | 0) + "m " + v86util.pad0(time % 60, 2) + "s";
        }
        else
        {
            return (time / 3600 | 0) + "h " +
                v86util.pad0((time / 60 | 0) % 60, 2) + "m " +
                v86util.pad0(time % 60, 2) + "s";
        }
    }

    function chr_repeat(chr, count)
    {
        var result = "";

        while(count-- > 0)
        {
            result += chr;
        }

        return result;
    }

    var progress_ticks = 0;

    function show_progress(e)
    {
        var el = $("loading");
        el.style.display = "block";

        if(e.file_name.endsWith(".wasm"))
        {
            const parts = e.file_name.split("/");
            el.textContent = "Fetching " + parts[parts.length - 1] + " ...";
            return;
        }

        if(e.file_index === e.file_count - 1 && e.loaded >= e.total - 2048)
        {
            // last file is (almost) loaded
            el.textContent = "Done downloading. Starting now ...";
            return;
        }

        var line = "Downloading images ";

        if(typeof e.file_index === "number" && e.file_count)
        {
            line += "[" + (e.file_index + 1) + "/" + e.file_count + "] ";
        }

        if(e.total && typeof e.loaded === "number")
        {
            var per100 = Math.floor(e.loaded / e.total * 100);
            per100 = Math.min(100, Math.max(0, per100));

            var per50 = Math.floor(per100 / 2);

            line += per100 + "% [";
            line += chr_repeat("#", per50);
            line += chr_repeat(" ", 50 - per50) + "]";
        }
        else
        {
            line += chr_repeat(".", progress_ticks++ % 50);
        }

        el.textContent = line;
    }

    function $(id)
    {
        return document.getElementById(id);
    }

    function onload()
    {
        if(!window.WebAssembly)
        {
            alert("Your browser is not supported because it doesn't support WebAssembly");
            return;
        }

        const script = document.createElement("script");
        script.src = "build/xterm.js";
        script.async = true;
        document.body.appendChild(script);

        var settings = {};

        $("start_emulation").onclick = function()
        {
            $("boot_options").style.display = "none";
            set_profile("custom");

            var images = [];
            var last_file;

            var floppy_file = $("floppy_image").files[0];
            if(floppy_file)
            {
                last_file = floppy_file;
                settings.fda = { buffer: floppy_file };
            }

            var cd_file = $("cd_image").files[0];
            if(cd_file)
            {
                last_file = cd_file;
                settings.cdrom = { buffer: cd_file };
            }

            var hda_file = $("hda_image").files[0];
            if(hda_file)
            {
                last_file = hda_file;
                settings.hda = { buffer: hda_file };
            }

            var hdb_file = $("hdb_image") && $("hdb_image").files[0];
            if(hdb_file)
            {
                last_file = hdb_file;
                settings.hdb = { buffer: hdb_file };
            }

            if($("multiboot_image"))
            {
                var multiboot_file = $("multiboot_image").files[0];
                if(multiboot_file)
                {
                    last_file = multiboot_file;
                    settings.multiboot = { buffer: multiboot_file };
                }
            }

            if(last_file)
            {
                set_title(last_file.name);
            }

            start_emulation(settings);
        };

        if(DEBUG)
        {
            debug_onload(settings);
        }

        // Abandonware OS images are from https://winworldpc.com/library/operating-systems
        var oses = [
            {
                id: "archlinux",
                name: "Arch Linux",
                memory_size: 512 * 1024 * 1024,
                vga_memory_size: 8 * 1024 * 1024,
                state: {
                    "url": HOST + "arch_state.bin.zst",
                },
                filesystem: {
                    "baseurl": HOST + "arch/",
                },
            },
            {
                id: "haiku",
                memory_size: 512 * 1024 * 1024,
                hda: {
                    url: HOST + "haiku.img",
                    async: true,
                    use_parts: !ON_LOCALHOST,
                    size: 1 * 1024 * 1024 * 1024,
                },
                state: {
                    url: HOST + "haiku_state.bin.zst",
                },
                name: "Haiku",
            },
            {
                id: "msdos",
                hda: {
                    "url": HOST + "msdos.img",
                    "size": 8 * 1024 * 1024,
                    "async": false,
                },
                boot_order: 0x132,
                name: "MS-DOS",
            },
            {
                id: "freedos",
                fda: {
                    "url": HOST + "freedos722.img",
                    "size": 737280,
                    "async": false,
                },
                name: "FreeDOS",
            },
            {
                id: "oberon",
                hda: {
                    "url": HOST + "oberon.img",
                    "size": 24 * 1024 * 1024,
                    "async": false,
                },
                name: "Oberon",
            },
            {
                id: "windows1",
                fda: {
                    "url": HOST + "windows101.img",
                    "size": 1474560,
                    "async": false,
                },
                name: "Windows",
            },
            {
                id: "linux26",
                cdrom: {
                    "url": HOST + "linux.iso",
                    "size": 6547456,
                    "async": false,
                },
                name: "Linux",
            },
            {
                id: "linux3",
                cdrom: {
                    "url": HOST + "linux3.iso",
                    "size": 8624128,
                    "async": false,
                },
                name: "Linux",
            },
            {
                id: "linux4",
                cdrom: {
                    "url": HOST + "linux4.iso",
                    "size": 7731200,
                    "async": false,
                },
                name: "Linux",
                filesystem: {},
            },
            {
                id: "buildroot",
                bzimage: {
                    url: HOST + "buildroot-bzimage.bin",
                    size: 5166352,
                    async: false,
                },
                name: "Buildroot Linux",
                filesystem: {},
                memory_size: 128 * 1024 * 1024,
                cmdline: "tsc=reliable mitigations=off random.trust_cpu=on",
            },
            {
                id: "dsl",
                memory_size: 256 * 1024 * 1024,
                cdrom: {
                    url: HOST + "dsl-4.11.rc2.iso",
                    size: 52824064,
                    async: false,
                },
                name: "Damn Small Linux",
                homepage: "http://www.damnsmalllinux.org/",
            },
            {
                id: "minix",
                name: "Minix",
                memory_size: 256 * 1024 * 1024,
                cdrom: {
                    url: HOST + "minix-3.3.0.iso",
                    size: 605581312,
                    async: true,
                    use_parts: !ON_LOCALHOST,
                },
            },
            {
                id: "kolibrios",
                fda: {
                    "url": ON_LOCALHOST ?
                            HOST + "kolibri.img" :
                            "//builds.kolibrios.org/eng/data/data/kolibri.img",
                    "size": 1474560,
                    "async": false,
                },
                name: "KolibriOS",
                homepage: "https://kolibrios.org/en/",
            },
            {
                id: "kolibrios-fallback",
                fda: {
                    "url": HOST + "kolibri.img",
                    "size": 1474560,
                    "async": false,
                },
                name: "KolibriOS",
            },
            {
                id: "openbsd",
                hda: {
                    "url": HOST + "openbsd.img",
                    async: true,
                    use_parts: !ON_LOCALHOST,
                    size: 1073741824,
                },
                state: {
                    url: HOST + "openbsd_state.bin.zst",
                },
                memory_size: 256 * 1024 * 1024,
                name: "OpenBSD",
            },
            {
                id: "openbsd-boot",
                hda: {
                    url: HOST + "openbsd.img",
                    async: true,
                    use_parts: !ON_LOCALHOST,
                    size: 1073741824,
                },
                memory_size: 256 * 1024 * 1024,
                name: "OpenBSD",
                //acpi: true, // doesn't seem to work
            },
            {
                id: "netbsd",
                hda: {
                    "url": HOST + "netbsd.img",
                    async: true,
                    use_parts: !ON_LOCALHOST,
                    size: 511000064,
                },
                memory_size: 256 * 1024 * 1024,
                name: "NetBSD",
            },
            {
                id: "solos",
                fda: {
                    "url": HOST + "os8.img",
                    "async": false,
                    "size": 1474560,
                },
                name: "Sol OS",
                homepage: "http://oby.ro/os/",
            },
            {
                id: "bootchess",
                fda: {
                    "url": HOST + "bootchess.img",
                    "async": false,
                    "size": 1474560,
                },
                name: "BootChess",
                homepage: "http://www.pouet.net/prod.php?which=64962",
            },
            {
                id: "bootbasic",
                fda: {
                    "url": HOST + "bootbasic.img",
                    "async": false,
                    "size": 1474560,
                },
                name: "bootBASIC",
                homepage: "https://github.com/nanochess/bootBASIC",
            },
            {
                id: "floppybird",
                fda: {
                    "url": HOST + "floppybird.img",
                    "async": false,
                    "size": 1474560,
                },
                name: "Floppy Bird",
                homepage: "http://mihail.co/floppybird",
            },
            {
                id: "windows2000",
                memory_size: 512 * 1024 * 1024,
                hda: {
                    "url": HOST + "windows2k.img",
                    "size": 2 * 1024 * 1024 * 1024,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "Windows 2000",
                state: {
                    "url": HOST + "windows2k_state.bin.zst",
                },
                preserve_mac_from_state_image: true,
            },
            {
                id: "windows2000-boot",
                memory_size: 512 * 1024 * 1024,
                hda: {
                    "url": HOST + "windows2k.img",
                    "size": 2 * 1024 * 1024 * 1024,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                boot_order: 0x132,
                name: "Windows 2000",
            },
            {
                id: "windows98",
                memory_size: 128 * 1024 * 1024,
                hda: {
                    "url": HOST + "windows98.img",
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                    "size": 300 * 1024 * 1024,
                },
                name: "Windows 98",
                state: {
                    "url": HOST + "windows98_state.bin.zst",
                },
                preserve_mac_from_state_image: true,
            },
            {
                id: "windows98-boot",
                memory_size: 128 * 1024 * 1024,
                hda: {
                    "url": HOST + "windows98.img",
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                    "size": 300 * 1024 * 1024,
                },
                name: "Windows 98",
            },
            {
                id: "windows95",
                memory_size: 32 * 1024 * 1024,
                hda: {
                    "url": HOST + "w95.img",
                    "size": 242049024,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "Windows 95",
                state: {
                    "url": HOST + "windows95_state.bin.zst",
                },
            },
            {
                id: "windows95-boot",
                memory_size: 32 * 1024 * 1024,
                hda: {
                    "url": HOST + "w95.img",
                    "size": 242049024,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "Windows 95",
            },
            {
                id: "windows30",
                memory_size: 64 * 1024 * 1024,
                cdrom: {
                    "url": HOST + "Win30.iso",
                    "async": false,
                },
                name: "Windows 3.0",
            },
            {
                id: "windows31",
                memory_size: 64 * 1024 * 1024,
                hda: {
                    "url": HOST + "win31.img",
                    "async": false,
                    "size": 34463744,
                },
                name: "Windows 3.1",
            },
            {
                id: "freebsd",
                memory_size: 256 * 1024 * 1024,
                hda: {
                    "url": HOST + "freebsd.img",
                    "size": 2147483648,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                state: {
                    "url": HOST + "freebsd_state.bin.zst",
                },
                name: "FreeBSD",
            },
            {
                id: "freebsd-boot",
                memory_size: 256 * 1024 * 1024,
                hda: {
                    "url": HOST + "freebsd.img",
                    "size": 2147483648,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "FreeBSD",
            },
            {
                id: "reactos-livecd",
                memory_size: 256 * 1024 * 1024,
                hda: {
                    "url": HOST + "reactos-livecd-0.4.15-dev-73-g03c09c9-x86-gcc-lin-dbg.iso",
                    "size": 250609664,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "ReactOS",
                homepage: "https://reactos.org/",
            },
            {
                id: "reactos",
                memory_size: 512 * 1024 * 1024,
                hda: {
                    "url": HOST + "reactos.img",
                    "size": 500 * 1024 * 1024,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                state: {
                    "url": HOST + "reactos_state.bin.zst",
                },
                preserve_mac_from_state_image: true,
                name: "ReactOS",
                homepage: "https://reactos.org/",
            },
            {
                id: "reactos-boot",
                memory_size: 512 * 1024 * 1024,
                hda: {
                    "url": HOST + "reactos.img",
                    "size": 500 * 1024 * 1024,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "ReactOS",
                homepage: "https://reactos.org/",
            },
            {
                id: "skift",
                memory_size: 128 * 1024 * 1024,
                cdrom: {
                    "url": HOST + "skift-20200910.iso",
                    "size": 64452608,
                    "async": false,
                },
                name: "Skift",
                homepage: "https://skiftos.org/",
            },
            {
                id: "snowdrop",
                memory_size: 128 * 1024 * 1024,
                fda: {
                    "url": HOST + "snowdrop.img",
                    "size": 1440 * 1024,
                    "async": false,
                },
                name: "Snowdrop",
                homepage: "http://www.sebastianmihai.com/snowdrop/",
            },
            {
                id: "openwrt",
                memory_size: 128 * 1024 * 1024,
                hda: {
                    "url": HOST + "openwrt-18.06.1-x86-legacy-combined-squashfs.img",
                    "size": 19846474,
                    "async": false,
                },
                name: "OpenWrt",
            },
            {
                id: "qnx",
                memory_size: 128 * 1024 * 1024,
                fda: {
                    url: HOST + "qnx-demo-network-4.05.img",
                    size: 1474560,
                    async: false
                },
                name: "QNX 4.05",
            },
            {
                id: "9front",
                memory_size: 128 * 1024 * 1024,
                hda: {
                    url: HOST + "9front-7781.38dcaeaa222c.386.iso",
                    size: 496388096,
                    async: true,
                    use_parts: !ON_LOCALHOST,
                },
                state: {
                    "url": HOST + "9front_state.bin.zst",
                },
                acpi: true,
                name: "9front",
            },
            {
                id: "9front-boot",
                memory_size: 128 * 1024 * 1024,
                hda: {
                    url: HOST + "9front-7781.38dcaeaa222c.386.iso",
                    size: 496388096,
                    async: true,
                    use_parts: !ON_LOCALHOST,
                },
                acpi: true,
                name: "9front",
            },
            {
                id: "mobius",
                memory_size: 64 * 1024 * 1024,
                fda: {
                    "url": HOST + "mobius-fd-release5.img",
                    "size": 1474560,
                    "async": false,
                },
                name: "Mobius",
            },
            {
                id: "android",
                memory_size: 512 * 1024 * 1024,
                cdrom: {
                    "url": HOST + "android-x86-1.6-r2.iso",
                    "size": 54661120,
                    "async": true,
                    use_parts: !ON_LOCALHOST,
                },
                name: "Android",
            },
            {
                id: "tinycore",
                memory_size: 256 * 1024 * 1024,
                hda: {
                    "url": HOST + "TinyCore-11.0.iso",
                    "async": false,
                },
                name: "Tinycore",
                homepage: "http://www.tinycorelinux.net/",
            },
        ];

        if(DEBUG)
        {
            // see tests/kvm-unit-tests/x86/
            var tests = [
                "realmode",
                // All tests below require an APIC
                "cmpxchg8b",
                "port80",
                "setjmp",
                "sieve",
                "hypercall", // crashes
                "init", // stops execution
                "msr", // TODO: Expects 64 bit msrs
                "smap", // test stops, SMAP not enabled
                "tsc_adjust", // TODO: IA32_TSC_ADJUST
                "tsc", // TODO: rdtscp
                "rmap_chain", // crashes
                "memory", // missing mfence (uninteresting)
                "taskswitch", // TODO: Jump
                "taskswitch2", // TODO: Call TSS
                "eventinj", // Missing #nt
                "ioapic",
                "apic",
            ];

            for(let test of tests)
            {
                oses.push({
                    name: "Test case: " + test,
                    id: "test-" + test,
                    memory_size: 128 * 1024 * 1024,
                    multiboot: { "url": "tests/kvm-unit-tests/x86/" + test + ".flat", }
                });
            }
        }

        var query_args = get_query_arguments();
        var profile = query_args["profile"];

        if(!profile && !DEBUG)
        {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = "build/v86.wasm";
            document.head.appendChild(link);
        }

        if(query_args["use_bochs_bios"])
        {
            settings.use_bochs_bios = true;
        }

        for(var i = 0; i < oses.length; i++)
        {
            var infos = oses[i];

            if(profile === infos.id)
            {
                start_profile(infos);
                return;
            }

            var element = $("start_" + infos.id);

            if(element)
            {
                element.onclick = function(infos, element, e)
                {
                    e.preventDefault();
                    set_profile(infos.id);
                    element.blur();

                    start_profile(infos);
                }.bind(this, infos, element);
            }
        }

        if(profile === "custom")
        {
            if(query_args["hda.url"])
            {
                settings.hda = {
                    "size": parseInt(query_args["hda.size"], 10) || undefined,
                    "url": query_args["hda.url"],
                    "async": true,
                };
            }

            if(query_args["cdrom.url"])
            {
                settings.cdrom = {
                    "size": parseInt(query_args["cdrom.size"], 10) || undefined,
                    "url": query_args["cdrom.url"],
                    "async": true,
                };
            }

            if(query_args["fda.url"])
            {
                settings.fda = {
                    "size": parseInt(query_args["fda.size"], 10) || undefined,
                    "url": query_args["fda.url"],
                    "async": false,
                };
            }

            if(settings.fda || settings.cdrom || settings.hda)
            {
                $("boot_options").style.display = "none";

                start_emulation(settings, done);
            }
        }

        function start_profile(infos)
        {
            $("boot_options").style.display = "none";
            set_title(infos.name);

            settings.filesystem = infos.filesystem;

            if(infos.state)
            {
                $("reset").style.display = "none";
                settings.initial_state = infos.state;
            }

            settings.fda = infos.fda;
            settings.cdrom = infos.cdrom;
            settings.hda = infos.hda;
            settings.multiboot = infos.multiboot;
            settings.bzimage = infos.bzimage;
            settings.initrd = infos.initrd;
            settings.cmdline = infos.cmdline;
            settings.bzimage_initrd_from_filesystem = infos.bzimage_initrd_from_filesystem;
            settings.preserve_mac_from_state_image = infos.preserve_mac_from_state_image;

            settings.acpi = infos.acpi;
            settings.memory_size = infos.memory_size;
            settings.vga_memory_size = infos.vga_memory_size;

            settings.id = infos.id;

            if(infos.boot_order !== undefined)
            {
                settings.boot_order = infos.boot_order;
            }

            if(!DEBUG && infos.homepage)
            {
                $("description").style.display = "block";
                const link = document.createElement("a");
                link.href = infos.homepage;
                link.textContent = infos.name;
                link.target = "_blank";
                $("description").appendChild(document.createTextNode("Running "));
                $("description").appendChild(link);
            }

            start_emulation(settings, done);
        }

        function done(emulator)
        {
            if(query_args["c"])
            {
                setTimeout(function()
                {
                    //emulator.serial0_send(query_args["c"] + "\n");
                    emulator.keyboard_send_text(query_args["c"] + "\n");
                }, 25);
            }
        }
    }

    function debug_onload(settings)
    {
        // called on window.onload, in debug mode

        var log_levels = $("log_levels");

        if(log_levels)
        {
            for(var i = 0; i < LOG_NAMES.length; i++)
            {
                var mask = LOG_NAMES[i][0];

                if(mask === 1)
                    continue;

                var name = LOG_NAMES[i][1].toLowerCase(),
                    input = document.createElement("input"),
                    label = document.createElement("label");

                input.type = "checkbox";

                label.htmlFor = input.id = "log_" + name;

                if(LOG_LEVEL & mask)
                {
                    input.checked = true;
                }
                input.mask = mask;

                label.appendChild(input);
                label.appendChild(document.createTextNode(v86util.pads(name, 4) + " "));
                log_levels.appendChild(label);

                if(i === Math.floor(LOG_NAMES.length / 2))
                {
                    log_levels.appendChild(document.createTextNode("\n"));
                }
            }

            log_levels.onchange = function(e)
            {
                var target = e.target,
                    mask = target.mask;

                if(target.checked)
                {
                    LOG_LEVEL |= mask;
                }
                else
                {
                    LOG_LEVEL &= ~mask;
                }

                target.blur();
            };
        }
    }

    window.addEventListener("load", onload, false);

    // old webkit fires popstate on every load, fuck webkit
    // https://code.google.com/p/chromium/issues/detail?id=63040
    window.addEventListener("load", function()
    {
        setTimeout(function()
        {
            window.addEventListener("popstate", onpopstate);
        }, 0);
    });

    // works in firefox and chromium
    if(document.readyState === "complete")
    {
        onload();
    }

    /** @param {?=} done */
    function start_emulation(settings, done)
    {
        /** @const */
        var MB = 1024 * 1024;

        var memory_size = settings.memory_size;

        if(!memory_size)
        {
            memory_size = parseInt($("memory_size").value, 10) * MB;

            if(!memory_size)
            {
                alert("Invalid memory size - reset to 128MB");
                memory_size = 128 * MB;
            }
        }

        var vga_memory_size = settings.vga_memory_size;

        if(!vga_memory_size)
        {
            vga_memory_size = parseInt($("video_memory_size").value, 10) * MB;

            if(!vga_memory_size)
            {
                alert("Invalid video memory size - reset to 8MB");
                vga_memory_size = 8 * MB;
            }
        }

        if(!settings.fda)
        {
            var floppy_file = $("floppy_image").files[0];
            if(floppy_file)
            {
                settings.fda = { buffer: floppy_file };
            }
        }

        const networking_proxy = $("networking_proxy").value;
        const disable_audio = $("disable_audio").checked;
        const enable_acpi = settings.acpi === undefined ? $("enable_acpi").checked : settings.acpi;

        /** @const */
        var BIOSPATH = "bios/";

        if(settings.use_bochs_bios)
        {
            var biosfile = "bochs-bios.bin";
            var vgabiosfile = "bochs-vgabios.bin";
        }
        else
        {
            var biosfile = DEBUG ? "seabios-debug.bin" : "seabios.bin";
            var vgabiosfile = DEBUG ? "vgabios-debug.bin" : "vgabios.bin";
        }

        var bios;
        var vga_bios;

        // a bios is only needed if the machine is booted
        if(!settings.initial_state)
        {
            bios = {
                "url": BIOSPATH + biosfile,
            };
            vga_bios = {
                "url": BIOSPATH + vgabiosfile,
            };
        }

        var emulator = new V86Starter({
            "memory_size": memory_size,
            "vga_memory_size": vga_memory_size,

            "screen_container": $("screen_container"),
            "serial_container_xtermjs": $("terminal"),

            "boot_order": settings.boot_order || parseInt($("boot_order").value, 16) || 0,

            // JvB commented out
            "network_relay_url": /* ON_LOCALHOST ? "ws://localhost:8080/" : */ networking_proxy,

            "bios": bios,
            "vga_bios": vga_bios,

            "fda": settings.fda,
            "hda": settings.hda,
            "hdb": settings.hdb,
            "cdrom": settings.cdrom,

            "multiboot": settings.multiboot,
            "bzimage": settings.bzimage,
            "initrd": settings.initrd,
            "cmdline": settings.cmdline,
            "bzimage_initrd_from_filesystem": settings.bzimage_initrd_from_filesystem,

            "acpi": enable_acpi,
            "initial_state": settings.initial_state,
            "filesystem": settings.filesystem || {},
            "disable_speaker": disable_audio,
            "preserve_mac_from_state_image": settings.preserve_mac_from_state_image,

            "autostart": true,
        });

        if(DEBUG) window["emulator"] = emulator;

        emulator.add_listener("emulator-ready", function()
        {
            if(DEBUG)
            {
                debug_start(emulator);
            }

            if(emulator.v86.cpu.wm.exports["profiler_is_enabled"]())
            {
                const CLEAR_STATS = false;

                var panel = document.createElement("pre");
                document.body.appendChild(panel);

                setInterval(function()
                    {
                        if(!emulator.is_running())
                        {
                            return;
                        }

                        const text = print_stats.stats_to_string(emulator.v86.cpu);
                        panel.textContent = text;

                        CLEAR_STATS && emulator.v86.cpu.clear_opstats();
                    }, CLEAR_STATS ? 5000 : 1000);
            }

            if(settings.id === "dsl")
            {
                setTimeout(() => {
                    // hack: Start automatically
                    emulator.keyboard_send_text("\n");
                }, 3000);
            }
            else if(settings.id == "android")
            {
                setTimeout(() => {
                    // hack: select vesa mode and start automatically
                    emulator.keyboard_send_scancodes([0xe050, 0xe050 | 0x80]);
                    emulator.keyboard_send_text("\n");
                }, 3000);
            }

            init_ui(settings, emulator);

            done && done(emulator);
        });

        emulator.add_listener("download-progress", function(e)
        {
            show_progress(e);
        });

        emulator.add_listener("download-error", function(e)
        {
            var el = $("loading");
            el.style.display = "block";
            el.textContent = "Loading " + e.file_name + " failed. Check your connection " +
                             "and reload the page to try again.";
        });
    }

    /**
     * @param {Object} settings
     * @param {V86Starter} emulator
     */
    function init_ui(settings, emulator)
    {
        $("boot_options").style.display = "none";
        $("loading").style.display = "none";
        $("runtime_options").style.display = "block";
        $("runtime_infos").style.display = "block";
        $("screen_container").style.display = "block";

        if(settings.filesystem)
        {
            init_filesystem_panel(emulator);
        }

        $("run").onclick = function()
        {
            if(emulator.is_running())
            {
                $("run").value = "Run";
                emulator.stop();
            }
            else
            {
                $("run").value = "Pause";
                emulator.run();
            }

            $("run").blur();
        };

        $("exit").onclick = function()
        {
            emulator.stop();
            location.href = location.pathname;
        };

        $("lock_mouse").onclick = function()
        {
            if(!mouse_is_enabled)
            {
                $("toggle_mouse").onclick();
            }

            emulator.lock_mouse();
            $("lock_mouse").blur();
        };

        var mouse_is_enabled = true;

        $("toggle_mouse").onclick = function()
        {
            mouse_is_enabled = !mouse_is_enabled;

            emulator.mouse_set_status(mouse_is_enabled);
            $("toggle_mouse").value = (mouse_is_enabled ? "Dis" : "En") + "able mouse";
            $("toggle_mouse").blur();
        };


        var last_tick = 0;
        var running_time = 0;
        var last_instr_counter = 0;
        var interval = null;
        var os_uses_mouse = false;
        var total_instructions = 0;

        function update_info()
        {
            var now = Date.now();

            var instruction_counter = emulator.get_instruction_counter();

            if(instruction_counter < last_instr_counter)
            {
                // 32-bit wrap-around
                last_instr_counter -= 0x100000000;
            }

            var last_ips = instruction_counter - last_instr_counter;
            last_instr_counter = instruction_counter;
            total_instructions += last_ips;

            var delta_time = now - last_tick;
            running_time += delta_time;
            last_tick = now;

            $("speed").textContent = (last_ips / 1000 / delta_time).toFixed(1);
            $("avg_speed").textContent = (total_instructions / 1000 / running_time).toFixed(1);
            $("running_time").textContent = format_timestamp(running_time / 1000 | 0);
        }

        emulator.add_listener("emulator-started", function()
        {
            last_tick = Date.now();
            interval = setInterval(update_info, 1000);
        });

        emulator.add_listener("emulator-stopped", function()
        {
            update_info();
            if(interval !== null)
            {
                clearInterval(interval);
            }
        });

        var stats_9p = {
            read: 0,
            write: 0,
            files: [],
        };

        emulator.add_listener("9p-read-start", function(args)
        {
            const file = args[0];
            stats_9p.files.push(file);
            $("info_filesystem").style.display = "block";
            $("info_filesystem_status").textContent = "Loading ...";
            $("info_filesystem_last_file").textContent = file;
        });
        emulator.add_listener("9p-read-end", function(args)
        {
            stats_9p.read += args[1];
            $("info_filesystem_bytes_read").textContent = stats_9p.read;

            const file = args[0];
            stats_9p.files = stats_9p.files.filter(f => f !== file);

            if(stats_9p.files[0])
            {
                $("info_filesystem_last_file").textContent = stats_9p.files[0];
            }
            else
            {
                $("info_filesystem_status").textContent = "Idle";
            }
        });
        emulator.add_listener("9p-write-end", function(args)
        {
            stats_9p.write += args[1];
            $("info_filesystem_bytes_written").textContent = stats_9p.write;

            if(!stats_9p.files[0])
            {
                $("info_filesystem_last_file").textContent = args[0];
            }
        });

        var stats_storage = {
            read: 0,
            read_sectors: 0,
            write: 0,
            write_sectors: 0,
        };

        emulator.add_listener("ide-read-start", function()
        {
            $("info_storage").style.display = "block";
            $("info_storage_status").textContent = "Loading ...";
        });
        emulator.add_listener("ide-read-end", function(args)
        {
            stats_storage.read += args[1];
            stats_storage.read_sectors += args[2];

            $("info_storage_status").textContent = "Idle";
            $("info_storage_bytes_read").textContent = stats_storage.read;
            $("info_storage_sectors_read").textContent = stats_storage.read_sectors;
        });
        emulator.add_listener("ide-write-end", function(args)
        {
            stats_storage.write += args[1];
            stats_storage.write_sectors += args[2];

            $("info_storage_bytes_written").textContent = stats_storage.write;
            $("info_storage_sectors_written").textContent = stats_storage.write_sectors;
        });

        var stats_net = {
            bytes_transmitted: 0,
            bytes_received: 0,
        };

        emulator.add_listener("eth-receive-end", function(args)
        {
            stats_net.bytes_received += args[0];

            $("info_network").style.display = "block";
            $("info_network_bytes_received").textContent = stats_net.bytes_received;
        });
        emulator.add_listener("eth-transmit-end", function(args)
        {
            stats_net.bytes_transmitted += args[0];

            $("info_network").style.display = "block";
            $("info_network_bytes_transmitted").textContent = stats_net.bytes_transmitted;
        });


        emulator.add_listener("mouse-enable", function(is_enabled)
        {
            os_uses_mouse = is_enabled;
            $("info_mouse_enabled").textContent = is_enabled ? "Yes" : "No";
        });

        emulator.add_listener("screen-set-mode", function(is_graphical)
        {
            if(is_graphical)
            {
                $("info_vga_mode").textContent = "Graphical";
            }
            else
            {
                $("info_vga_mode").textContent = "Text";
                $("info_res").textContent = "-";
                $("info_bpp").textContent = "-";
            }
        });
        emulator.add_listener("screen-set-size-graphical", function(args)
        {
            $("info_res").textContent = args[0] + "x" + args[1];
            $("info_bpp").textContent = args[4];
        });


        $("reset").onclick = function()
        {
            emulator.restart();
            $("reset").blur();
        };

        add_image_download_button(settings.hda, "hda");
        add_image_download_button(settings.hdb, "hdb");
        add_image_download_button(settings.fda, "fda");
        add_image_download_button(settings.fdb, "fdb");
        add_image_download_button(settings.cdrom, "cdrom");

        function add_image_download_button(obj, type)
        {
            var elem = $("get_" + type + "_image");

            if(!obj || obj.size > 100 * 1024 * 1024)
            {
                elem.style.display = "none";
                return;
            }

            elem.onclick = function(e)
            {
                let buffer = emulator.disk_images[type];
                let filename = settings.id + (type === "cdrom" ? ".iso" : ".img");

                if(buffer.get_as_file)
                {
                    var file = buffer.get_as_file(filename);
                    download(file, filename);
                }
                else
                {
                    buffer.get_buffer(function(b)
                    {
                        if(b)
                        {
                            dump_file(b, filename);
                        }
                        else
                        {
                            alert("The file could not be loaded. Maybe it's too big?");
                        }
                    });
                }

                elem.blur();
            };
        }

        $("memory_dump").onclick = function()
        {
            const mem8 = emulator.v86.cpu.mem8;
            dump_file(new Uint8Array(mem8.buffer, mem8.byteOffset, mem8.length), "v86memory.bin");
            $("memory_dump").blur();
        };

        //$("memory_dump_dmp").onclick = function()
        //{
        //    var memory = emulator.v86.cpu.mem8;
        //    var memory_size = memory.length;
        //    var page_size = 4096;
        //    var header = new Uint8Array(4096);
        //    var header32 = new Int32Array(header.buffer);

        //    header32[0] = 0x45474150; // 'PAGE'
        //    header32[1] = 0x504D5544; // 'DUMP'

        //    header32[0x10 >> 2] = emulator.v86.cpu.cr[3]; // DirectoryTableBase
        //    header32[0x24 >> 2] = 1; // NumberProcessors
        //    header32[0xf88 >> 2] = 1; // DumpType: full dump
        //    header32[0xfa0 >> 2] = header.length + memory_size; // RequiredDumpSpace

        //    header32[0x064 + 0 >> 2] = 1; // NumberOfRuns
        //    header32[0x064 + 4 >> 2] = memory_size / page_size; // NumberOfPages
        //    header32[0x064 + 8 >> 2] = 0; // BasePage
        //    header32[0x064 + 12 >> 2] = memory_size / page_size; // PageCount

        //    dump_file([header, memory], "v86memory.dmp");

        //    $("memory_dump_dmp").blur();
        //};

        $("save_state").onclick = function()
        {
            emulator.save_state(function(error, result)
            {
                if(error)
                {
                    console.log(error.stack);
                    console.log("Couldn't save state: ", error);
                }
                else
                {
                    dump_file(result, "v86state.bin");
                }
            });

            $("save_state").blur();
        };

        $("load_state").onclick = function()
        {
            $("load_state_input").click();
            $("load_state").blur();
        };

        $("load_state_input").onchange = function()
        {
            var file = this.files[0];

            if(!file)
            {
                return;
            }

            var was_running = emulator.is_running();

            if(was_running)
            {
                emulator.stop();
            }

            var filereader = new FileReader();
            filereader.onload = function(e)
            {
                try
                {
                    emulator.restore_state(e.target.result);
                }
                catch(err)
                {
                    alert("Something bad happened while restoring the state:\n" + err + "\n\n" +
                          "Note that the current configuration must be the same as the original");
                    throw err;
                }

                if(was_running)
                {
                    emulator.run();
                }
            };
            filereader.readAsArrayBuffer(file);

            this.value = "";
        };

        $("ctrlaltdel").onclick = function()
        {
            emulator.keyboard_send_scancodes([
                0x1D, // ctrl
                0x38, // alt
                0x53, // delete

                // break codes
                0x1D | 0x80,
                0x38 | 0x80,
                0x53 | 0x80,
            ]);

            $("ctrlaltdel").blur();
        };

        $("alttab").onclick = function()
        {
            emulator.keyboard_send_scancodes([
                0x38, // alt
                0x0F, // tab
            ]);

            setTimeout(function()
            {
                emulator.keyboard_send_scancodes([
                    0x38 | 0x80,
                    0x0F | 0x80,
                ]);
            }, 100);

            $("alttab").blur();
        };

        $("scale").onchange = function()
        {
            var n = parseFloat(this.value);

            if(n || n > 0)
            {
                emulator.screen_set_scale(n, n);
            }
        };

        $("fullscreen").onclick = function()
        {
            emulator.screen_go_fullscreen();
        };

        $("screen_container").onclick = function()
        {
            if(mouse_is_enabled && os_uses_mouse)
            {
                emulator.lock_mouse();
                $("lock_mouse").blur();
            }
            else
            {
                // allow text selection
                if(window.getSelection().isCollapsed)
                {
                    let phone_keyboard = document.getElementsByClassName("phone_keyboard")[0];

                    // stop mobile browser from scrolling into view when the keyboard is shown
                    phone_keyboard.style.top = document.body.scrollTop + 100 + "px";
                    phone_keyboard.style.left = document.body.scrollLeft + 100 + "px";

                    phone_keyboard.focus();
                }
            }
        };

        const phone_keyboard = document.getElementsByClassName("phone_keyboard")[0];

        phone_keyboard.setAttribute("autocorrect", "off");
        phone_keyboard.setAttribute("autocapitalize", "off");
        phone_keyboard.setAttribute("spellcheck", "false");
        phone_keyboard.tabIndex = 0;

        $("screen_container").addEventListener("mousedown", (e) =>
        {
            e.preventDefault();
            phone_keyboard.focus();
        }, false);

        $("take_screenshot").onclick = function()
        {
            emulator.screen_make_screenshot();

            $("take_screenshot").blur();
        };

        window.addEventListener("keydown", ctrl_w_rescue, false);
        window.addEventListener("keyup", ctrl_w_rescue, false);
        window.addEventListener("blur", ctrl_w_rescue, false);

        function ctrl_w_rescue(e)
        {
            if(e.ctrlKey)
            {
                window.onbeforeunload = function()
                {
                    window.onbeforeunload = null;
                    return "CTRL-W cannot be sent to the emulator.";
                };
            }
            else
            {
                window.onbeforeunload = null;
            }
        }
    }

    function init_filesystem_panel(emulator)
    {
        $("filesystem_panel").style.display = "block";

        $("filesystem_send_file").onchange = function()
        {
            Array.prototype.forEach.call(this.files, function(file)
            {
                var loader = new v86util.SyncFileBuffer(file);
                loader.onload = function()
                {
                    loader.get_buffer(function(buffer)
                    {
                        emulator.create_file("/" + file.name, new Uint8Array(buffer));
                    });
                };
                loader.load();
            }, this);

            this.value = "";
            this.blur();
        };

        $("filesystem_get_file").onkeypress = function(e)
        {
            if(e.which !== 13)
            {
                return;
            }

            this.disabled = true;

            emulator.read_file(this.value, function(err, uint8array)
            {
                this.disabled = false;

                if(uint8array)
                {
                    var filename = this.value.replace(/\/$/, "").split("/");
                    filename = filename[filename.length - 1] || "root";

                    dump_file(uint8array, filename);
                    this.value = "";
                }
                else
                {
                    alert("Can't read file");
                }
            }.bind(this));
        };
    }

    function debug_start(emulator)
    {
        if(!emulator.v86)
        {
            return;
        }

        // called as soon as soon as emulation is started, in debug mode
        var debug = emulator.v86.cpu.debug;

        $("dump_gdt").onclick = debug.dump_gdt_ldt.bind(debug);
        $("dump_idt").onclick = debug.dump_idt.bind(debug);
        $("dump_regs").onclick = debug.dump_regs.bind(debug);
        $("dump_pt").onclick = debug.dump_page_directory.bind(debug);

        $("dump_log").onclick = function()
        {
            dump_file(log_data.join(""), "v86.log");
        };

        var cpu = emulator.v86.cpu;

        $("debug_panel").style.display = "block";
        setInterval(function()
        {
            $("debug_panel").textContent =
                cpu.debug.get_regs_short().join("\n") + "\n" + cpu.debug.get_state();

            $("dump_log").value = "Dump log" + (log_data.length ? " (" + log_data.length + " lines)" : "");
        }, 1000);

        // helps debugging
        window.emulator = emulator;
        window.cpu = cpu;
        window.dump_file = dump_file;
    }

    function onpopstate(e)
    {
        location.reload();
    }

    function set_profile(prof)
    {
        if(window.history.pushState)
        {
            window.history.pushState({ profile: prof }, "", "?profile=" + prof);
        }

    }

})();
