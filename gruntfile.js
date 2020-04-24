module.exports = function(grunt) {

    require("matchdep").filterDev("grunt-*").forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        htmlhint: {
            build: {
                options: {
                    'tag-pair': true,
                    'tagname-lowercase': true,
                    'attr-lowercase': true,
                    'attr-value-double-quotes': true,
                    'doctype-first': true,
                    'spec-char-escape': true,
                    'id-unique': true
                },
                src: ['index.html']
            }
        },

        uglify: {
            build: {
                files: {
                    'build/js/script.min.js': ['assets/js/lib/bootstrap.min2.js', 'assets/js/lib/typeahead.js', 'assets/js/lib/mustache.js', 'assets/js/navMap.js', 'assets/js/navigator.js', 'assets/js/timescale.js', 'assets/js/reconstruct.js', 'assets/js/taxaBrowser.js', 'assets/js/diversity.js']
                }
            }
        },

        cssmin: {
          combine: {
            files: {
              'build/css/navigator.min.css': ['assets/css/lib/bootstrapRC2.min.css', 'assets/css/lib/typeahead.css', 'assets/css/timescale.css', 'assets/css/taxaBrowser.css', 'assets/css/navigator.css']
            }
          }
        },

        shell: {
            plates: {
                command: 'node build_plate_cache.js',
                options: {
                    stdout: true,
                    execOptions: {
                        cwd: 'assets/js/utilities'
                    }
                }
            },
            badPlates: {
                command: 'node fix_bad_plates.js',
                options: {
                    stdout: true,
                    execOptions: {
                        cwd: 'assets/js/utilities'
                    }
                }
            },
            rotations: {
                command: 'node build_rotation_cache.js',
                options: {
                    stdout: true,
                    execOptions: {
                        cwd: 'assets/js/utilities'
                    }
                }
            },
            oldCollections: {
                command: 'node get_old_collections.js',
                options: {
                    stdout: true,
                    execOptions: {
                        cwd: 'assets/js/utilities'
                    }
                }
            }
        },

        watch: {
            html: {
                files: ['index.html'],
                tasks: ['htmlhint']
            },
            js: {
                files: ['assets/js/lib/bootstrap.min.js', 'assets/js/lib/typeahead.js', 'assets/js/lib/mustache.js', 'assets/js/navMap.js', 'assets/js/navigator.js', 'assets/js/timescale.js', 'assets/js/reconstruct.js', 'assets/js/taxaBrowser.js', 'assets/js/diversity.js'],
                tasks: ['uglify']
            },
            css: {
                files: ['assets/css/lib/bootstrapRC2.min.css', 'assets/css/lib/typeahead.css', 'assets/css/timescale.css', 'assets/css/taxaBrowser.css', 'assets/css/navigator.css'],
                tasks: ['cssmin']
            }
        }
    });

    grunt.registerTask('default', ['htmlhint', 'uglify', 'cssmin']);

};
