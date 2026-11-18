// SPDX-License-Identifier: GPL-2.0
/*
 * hmbird_patch - Forcefully convert OPLUS HMBird kernel type from HMBIRD_OGKI to HMBIRD_GKI
 *
 * The OPLUS HMBird framework determines the kernel type via the "type" property
 * in the device tree node /soc/oplus,hmbird/version_type. OGKI = official GKI,
 * GKI = custom GKI. This patch rewrites it during early boot so the system does
 * not impose restrictions on custom kernels.
 */

#include <linux/init.h>
#include <linux/module.h>
#include <linux/of.h>
#include <linux/slab.h>
#include <linux/string.h>

#define HMBIRD_NODE_PATH "/soc/oplus,hmbird/version_type"
#define HMBIRD_PROP_NAME "type"
#define HMBIRD_OGKI      "HMBIRD_OGKI"
#define HMBIRD_GKI       "HMBIRD_GKI"

static int __init hmbird_patch_init(void)
{
	struct device_node *np;
	struct property *new_prop;
	const char *type;
	int ret;

	np = of_find_node_by_path(HMBIRD_NODE_PATH);
	if (!np)
		return 0;

	/* Read current value; skip if not OGKI */
	ret = of_property_read_string(np, HMBIRD_PROP_NAME, &type);
	if (ret || strcmp(type, HMBIRD_OGKI))
		goto out;

	/* Build new property (kzalloc ensures all fields are zero-initialized) */
	new_prop = kzalloc(sizeof(*new_prop), GFP_KERNEL);
	if (!new_prop)
		goto out;

	new_prop->name = kstrdup(HMBIRD_PROP_NAME, GFP_KERNEL);
	new_prop->value = kstrdup(HMBIRD_GKI, GFP_KERNEL);
	new_prop->length = strlen(HMBIRD_GKI) + 1;

	if (!new_prop->name || !new_prop->value)
		goto free_prop;

	/* of_update_property replaces atomically, safer than remove + add */
	ret = of_update_property(np, new_prop);
	if (ret) {
		pr_info("hmbird_patch: of_update_property failed (%d)\n", ret);
		goto free_prop;
	}

	pr_info("hmbird_patch: patched %s -> %s\n", HMBIRD_OGKI, HMBIRD_GKI);
	of_node_put(np);
	return 0;

free_prop:
	kfree(new_prop->value);
	kfree(new_prop->name);
	kfree(new_prop);
out:
	of_node_put(np);
	return 0;
}
early_initcall(hmbird_patch_init);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("reigadegr");
MODULE_DESCRIPTION("Forcefully convert HMBIRD_OGKI to HMBIRD_GKI.");
