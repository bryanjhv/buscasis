// @ts-check

import antfu from '@antfu/eslint-config'

export default antfu({
	astro: true,
	formatters: true,
	stylistic: {
		indent: 'tab',
	},
	typescript: {
		tsconfigPath: 'tsconfig.json',
		overridesTypeAware: {
			'ts/strict-boolean-expressions': 'off',
		},
	},
})
